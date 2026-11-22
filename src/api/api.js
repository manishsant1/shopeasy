// All server calls go through here. The API lives on the same origin under /api,
// so no base URL or CORS setup is needed.
import { load, save } from './storage';

// Anonymous per-browser ID so the server can return only this browser's orders.
// Replace with an auth token once sign-in exists.
function getClientId() {
  let id = load('clientId', null);
  if (!id) {
    // crypto.randomUUID only works on HTTPS or localhost, so fall back on plain-HTTP deployments.
    id = crypto.randomUUID?.() ?? Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    save('clientId', id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details);
  return data;
}

export const getCategories = () => request('/categories');
export const getProducts = () => request('/products');
export const getOrders = () => request('/orders');

export async function getProduct(id) {
  try {
    return await request(`/products/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Only product IDs and quantities are sent; the server looks up prices and computes the total.
export const placeOrder = ({ items, shipping, payment }) =>
  request('/orders', { method: 'POST', body: { items, shipping, payment } });
