import type { AppConfig, WordItem } from '../types';

export function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export interface RepoFileResponse {
  sha: string;
  words: WordItem[];
}

export async function fetchRepoWords(config: AppConfig, fetchFn = fetch): Promise<RepoFileResponse> {
  const { repoOwner, repoName, branch = 'main', filePath = 'public/words.json', githubToken } = config;

  if (!repoOwner || !repoName) {
    throw new Error('Не указаны владелец или имя репозитория в настройках');
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken.trim()}`;
  }

  const response = await fetchFn(url, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Файл "${cleanPath}" не найден в репозитории ${repoOwner}/${repoName} (ветка ${branch})`);
    }
    if (response.status === 401) {
      throw new Error('Ошибка авторизации: неверный GitHub токен');
    }
    if (response.status === 403) {
      throw new Error('Доступ запрещен (403): проверьте права токена (Contents: Read/Write) или лимиты API');
    }
    throw new Error(`Ошибка GitHub API (${response.status}): ${response.statusText}`);
  }

  const data = (await response.json()) as { sha: string; content: string };
  const decodedJson = decodeBase64Utf8(data.content);
  const words = JSON.parse(decodedJson) as WordItem[];

  return {
    sha: data.sha,
    words,
  };
}

export async function updateRepoWords(
  config: AppConfig,
  words: WordItem[],
  sha: string,
  fetchFn = fetch
): Promise<{ success: boolean; newSha: string }> {
  const { repoOwner, repoName, branch = 'main', filePath = 'public/words.json', githubToken } = config;

  if (!githubToken) {
    throw new Error('Для отправки изменений в GitHub необходим токен (PAT)');
  }
  if (!repoOwner || !repoName) {
    throw new Error('Не указаны владелец или имя репозитория в настройках');
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${cleanPath}`;

  const jsonContent = JSON.stringify(words, null, 2);
  const base64Content = encodeBase64Utf8(jsonContent);

  const payload = {
    message: `feat: update words dictionary (${words.length} items) via web app`,
    content: base64Content,
    sha,
    branch,
  };

  const response = await fetchFn(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken.trim()}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Конфликт версий (409): файл в репозитории был изменен. Обновите словарь перед сохранением.');
    }
    if (response.status === 401) {
      throw new Error('Ошибка авторизации (401): проверьте валидность токена.');
    }
    if (response.status === 403) {
      throw new Error('Недостаточно прав для записи в репозиторий (проверьте права токена Contents: Write).');
    }
    const errText = await response.text();
    throw new Error(`Ошибка сохранения (${response.status}): ${errText}`);
  }

  const result = (await response.json()) as { content?: { sha?: string } };
  return {
    success: true,
    newSha: result.content?.sha || '',
  };
}
