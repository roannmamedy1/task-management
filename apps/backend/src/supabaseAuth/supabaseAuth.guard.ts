import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { InternalServerErrorException } from "@nestjs/common";
import { SupabaseService } from "src/supabase/supabase.service";
import type { SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabaseClient: SupabaseClient | undefined;

  constructor(
    @Optional()
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabaseClient = undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];

    let token: string | undefined;

    if (authHeader && typeof authHeader === "string") {
      token = authHeader.replace(/^Bearer\s+/i, "");
    }

    if (!token) {
      const anyReq = request as any;
      const qsToken = anyReq?.query?.access_token || anyReq?.query?.token;
      if (qsToken && typeof qsToken === "string") {
        token = qsToken;
      }
    }

    if (!token) {
      throw new UnauthorizedException("No authorization header provided");
    }

    const supabaseClient =
      this.supabaseClient || this.supabaseService.getClient();
    if (!supabaseClient) {
      throw new InternalServerErrorException("Supabase client not initialized");
    }

    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    (request as any).user = user;

    return true;
  }
}
