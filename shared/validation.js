// Checkout rules shared by the form (instant feedback) and the API (the real check).
export const SHIPPING_FIELDS = [
  { name: 'fullName', label: 'Full name', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'address', label: 'Street address', autoComplete: 'street-address' },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'zip', label: 'ZIP / Postal code', autoComplete: 'postal-code' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
];

export const PAYMENT_METHODS = [
  ['card', 'Credit / debit card'],
  ['cod', 'Cash on delivery'],
  ['upi', 'UPI / wallet'],
];

export function validateShipping(form = {}) {
  const errors = {};
  for (const f of SHIPPING_FIELDS) {
    const value = form[f.name];
    if (typeof value !== 'string' || !value.trim()) errors[f.name] = 'Required';
    else if (value.length > 200) errors[f.name] = 'Too long';
  }
  if (!errors.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email';
  if (!errors.phone && !/^[\d\s+()-]{7,}$/.test(form.phone)) errors.phone = 'Enter a valid phone number';
  return errors;
}
