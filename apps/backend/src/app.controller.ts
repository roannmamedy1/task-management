import { Controller, Get, Post, Put, Delete, Res, BadRequestException, OnModuleInit, Logger, Body, Param } from '@nestjs/common';
import { Response } from 'express'; 
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController implements OnModuleInit {
  private taskDataSubscribers: Set<Response> = new Set();
  private adminDataSubscribers: Set<Response> = new Set();
  private readonly logger = new Logger(AppController.name);
  private lastTaskData: any = null;
  private lastAdminData: any = null;

  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService
  ) {}

  onModuleInit() {
    this.setupRealtimeListeners();
    this.startPolling();
  }

  private setupRealtimeListeners() {
    const client = this.supabaseService.getClient();

    // Subscribe to real-time changes
    const channel = client.channel('realtime:public:task').on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'task',
      },
      (payload: any) => {
        this.logger.log('Real-time update received from Supabase');
        this.broadcastUpdate();
      }
    );

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        this.logger.log('Successfully subscribed to real-time updates');
      } else if (status === 'CHANNEL_ERROR') {
        this.logger.error('Failed to subscribe to real-time channel');
      }
    });
  }

  private startPolling() {
    // Poll every 2 seconds as fallback for real-time updates
    setInterval(async () => {
      await this.broadcastUpdate();
    }, 2000);
  }

  private async broadcastUpdate() {
    try {
      const client = this.supabaseService.getClient();

      // Fetch latest task data
      const { data: taskData } = await client.from('task').select('*');
      const transformedTaskData = taskData?.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status === 'done',
      }));

      // Check if data changed and broadcast to task subscribers
      if (JSON.stringify(transformedTaskData) !== JSON.stringify(this.lastTaskData)) {
        this.lastTaskData = transformedTaskData;
        this.broadcastToSubscribers(this.taskDataSubscribers, transformedTaskData);
      }

      // Check if admin data changed and broadcast
      if (JSON.stringify(taskData) !== JSON.stringify(this.lastAdminData)) {
        this.lastAdminData = taskData;
        this.broadcastToSubscribers(this.adminDataSubscribers, taskData);
      }
    } catch (error) {
      this.logger.error('Error broadcasting update:', error);
    }
  }

  private broadcastToSubscribers(subscribers: Set<Response>, data: any) {
    const deadConnections: Response[] = [];

    subscribers.forEach((res) => {
      if (!res.writableEnded) {
        try {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          deadConnections.push(res);
        }
      } else {
        deadConnections.push(res);
      }
    });

    // Clean up dead connections
    deadConnections.forEach((res) => {
      subscribers.delete(res);
    });
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck(): string {
    return 'OK';
  }

  @Get('supabase-test')
  async supabaseTest() {
    const client = this.supabaseService.getClient();
    return {
      success: true,
      message: 'Supabase client is connected',
      clientInitialized: !!client,
    };
  }

  @Get('task-data')
  async getTaskData() {
    const { data, error } = await this.supabaseService.getClient().from('task').select('*');

    if (error) {
      return { success: false, error: error.message };
    }

    return data.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status === 'done',
    }));
  }

  @Get('admin-data')
  async getAdminData() {
    const { data, error } = await this.supabaseService.getClient().from('task').select('*');

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  }

  @Get('stream/tasks')
  streamTasks(@Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Add this response to subscribers
    this.taskDataSubscribers.add(res);

    // Send initial data
    this.supabaseService
      .getClient()
      .from('task')
      .select('*')
      .then(({ data }) => {
        const taskData = data?.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status === 'done',
        }));
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(taskData)}\n\n`);
        }
      });

    // Handle client disconnect
    res.on('close', () => {
      this.taskDataSubscribers.delete(res);
    });
  }

  @Get('stream/admin')
  streamAdmin(@Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Add this response to subscribers
    this.adminDataSubscribers.add(res);

    // Send initial data
    this.supabaseService
      .getClient()
      .from('task')
      .select('*')
      .then(({ data }) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      });

    // Handle client disconnect
    res.on('close', () => {
      this.adminDataSubscribers.delete(res);
    });
  }

  @Post('task')
  async createTask(@Body() body: { title: string; status?: string }) {
    if (!body.title || body.title.trim() === '') {
      throw new BadRequestException('Title is required');
    }

    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('task')
      .insert([
        {
          title: body.title.trim(),
          status: body.status || 'open',
        },
      ])
      .select();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      data: data?.[0] || null,
    };
  }

  @Put('task/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: { title?: string; status?: string }
  ) {
    if (!id) {
      throw new BadRequestException('ID is required');
    }

    const client = this.supabaseService.getClient();
    const updateData: any = {};

    if (body.title !== undefined) {
      if (body.title.trim() === '') {
        throw new BadRequestException('Title cannot be empty');
      }
      updateData.title = body.title.trim();
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    const { data, error } = await client
      .from('task')
      .update(updateData)
      .eq('id', parseInt(id, 10))
      .select();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      data: data?.[0] || null,
    };
  }

  @Delete('task/:id')
  async deleteTask(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('ID is required');
    }

    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('task')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }
}
