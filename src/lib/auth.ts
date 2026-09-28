import { apiRegister, apiLogin, apiLogout, removeToken } from "./laravel";

export type SignUpInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  location?: string;
  role: "lawyer" | "client";
  bar_number?: string;
  specializations?: string[];
  firm_name?: string;
};

export async function signUp(data: SignUpInput) {
  const payload = {
    name: data.full_name,
    email: data.email,
    password: data.password,
    password_confirmation: data.password,
    role: data.role,
    phone: data.phone,
    location: data.location,
    bar_number: data.bar_number,
    firm_name: data.firm_name,
    specializations: data.specializations,
  };

  const response = await apiRegister(payload);
  return {
    user: response.user,
    session: response.access_token ? { access_token: response.access_token } : null,
  };
}

export async function completeSignupIfNeeded(): Promise<void> {
  // Handled transparently by Laravel auth/me endpoint
}

export async function signIn(email: string, password: string) {
  const response = await apiLogin({ email, password });
  return {
    user: response.user,
    session: response.access_token ? { access_token: response.access_token } : null,
  };
}

export async function signOut() {
  await apiLogout();
}

export async function resetPassword(email: string) {
  // Mock password reset confirmation
  return true;
}

