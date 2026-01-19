import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class SupabaseAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async loginWithEmail(email: string, password: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    return data;
  }

  async signUpWithEmail(email: string, password: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(`Sign up failed: ${error.message}`);
    }

    return data;
  }

  async logout() {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
    return { message: "Logout successful" };
  }
}
