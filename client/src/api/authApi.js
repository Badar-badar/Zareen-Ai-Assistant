export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new Error("Too many attempts. Try again in 15 minutes.");
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data.token as string;
}