const BASE_URL = 'http://localhost:3000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // ignore JSON parse errors on error responses
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return {} as T;
}

export interface AuthResponse {
  access_token: string;
  token?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  owner: User;
  createdAt: string;
  updatedAt?: string;
  memberCount?: number;
  elements?: { id: string; type: string; data: Record<string, unknown> }[];
}

export interface StrokeElement {
  id?: string;
  type: 'stroke';
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface BoardElement {
  id: string;
  type: string;
  data: StrokeElement;
  createdAt: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false
  );
}

export async function register(
  email: string,
  username: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    },
    false
  );
}

export async function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export async function getBoards(): Promise<Board[]> {
  return request<Board[]>('/boards');
}

export async function createBoard(
  name: string,
  description: string,
  isPublic: boolean
): Promise<Board> {
  return request<Board>('/boards', {
    method: 'POST',
    body: JSON.stringify({ name, description, isPublic }),
  });
}

export async function getBoard(id: string): Promise<Board> {
  return request<Board>(`/boards/${id}`);
}

export async function deleteBoard(id: string): Promise<void> {
  return request<void>(`/boards/${id}`, {
    method: 'DELETE',
  });
}

export async function updateBoard(
  id: string,
  dto: { name?: string; description?: string; isPublic?: boolean },
): Promise<Board> {
  return request<Board>(`/boards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function createElement(
  boardId: string,
  element: StrokeElement
): Promise<BoardElement> {
  return request<BoardElement>(`/boards/${boardId}/elements`, {
    method: 'POST',
    body: JSON.stringify(element),
  });
}
