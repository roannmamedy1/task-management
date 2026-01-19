import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseAuthService } from "./supabaseAuth.service";
import { SupabaseAuthController } from "./supabaseAuth.controller";
import { SupabaseService } from "../supabase/supabase.service";
import { SupabaseAuthGuard } from "./supabaseAuth.guard";

@Module({
  imports: [ConfigModule],
  providers: [SupabaseAuthService, SupabaseService, SupabaseAuthGuard],
  controllers: [SupabaseAuthController],
  exports: [SupabaseAuthService],
})
export class SupabaseAuthModule {}
