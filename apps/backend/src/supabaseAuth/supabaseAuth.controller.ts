import { Controller, Post, Body, Get, UseGuards, Req } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthService } from "./supabaseAuth.service";
import { SupabaseAuthGuard } from "./supabaseAuth.guard";

@Controller("auth")
export class SupabaseAuthController {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}
  @Post("login")
  async login(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    return this.supabaseAuthService.loginWithEmail(email, password);
  }
  @Post("signup")
  async signUp(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    return this.supabaseAuthService.signUpWithEmail(email, password);
  }
  @Post("logout")
  async logout() {
    return this.supabaseAuthService.logout();
  }
  @Get("status")
  async status() {
    return { status: "Auth service is running" };
  }

  @UseGuards(SupabaseAuthGuard)
  @Get("check")
  async checkAuth(@Req() req: Request) {
    return (req as any).user;
  }
}
