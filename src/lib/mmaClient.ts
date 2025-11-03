const MMA_API_BASE = process.env.MMA_API_BASE || 'http://localhost:3000';
const MMA_API_KEY = process.env.MMA_API_KEY || '';

function ensureConfigured() {
  if (!MMA_API_KEY) {
    throw new Error('MMA_API_KEY is not set');
  }
}

function buildHeaders(extra?: Record<string, string>) {
  ensureConfigured();
  return {
    'x-mma-key': MMA_API_KEY,
    ...(extra || {})
  } as Record<string, string>;
}

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`MMA API error ${res.status}: ${message}`);
  }
  return body;
}

export type MmaCoursesResponse = {
  courses: Array<{
    id: string;
    title: string;
    description?: string;
    modules?: any[];
  }>;
};

export type MmaQuizzesResponse = {
  quizzes: Array<{
    id: string;
    title: string;
    courseId?: string;
  }>;
};

export type MmaQuizSubmitResponse = {
  result: {
    quizId: string;
    score: number;
    total: number;
    gradedAt: string;
  };
};

export const mmaClient = {
  async getCourses(): Promise<MmaCoursesResponse> {
    const res = await fetch(`${MMA_API_BASE}/api/v1/edu/content/courses`, {
      method: 'GET',
      headers: buildHeaders(),
      cache: 'no-store'
    });
    return handleResponse(res);
  },

  async getQuizzes(): Promise<MmaQuizzesResponse> {
    const res = await fetch(`${MMA_API_BASE}/api/v1/edu/quizzes`, {
      method: 'GET',
      headers: buildHeaders(),
      cache: 'no-store'
    });
    return handleResponse(res);
  },

  async submitQuiz(
    quizId: string,
    answers: number[],
    idempotencyKey?: string
  ): Promise<MmaQuizSubmitResponse> {
    const key = idempotencyKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    const res = await fetch(`${MMA_API_BASE}/api/v1/edu/quiz/${encodeURIComponent(quizId)}/submit`, {
      method: 'POST',
      headers: buildHeaders({
        'content-type': 'application/json',
        'Idempotency-Key': key
      }),
      body: JSON.stringify({ answers }),
      cache: 'no-store'
    });
    return handleResponse(res);
  }
};

export default mmaClient;


