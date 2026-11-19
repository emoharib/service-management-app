const ALLOWED_ROLES = new Set(['admin', 'service_manager', 'class_servant']);

function optionalText(value, fieldLabel) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'string') return { error: `${fieldLabel} غير صالح` };
  const trimmed = value.trim();
  return { value: trimmed || null };
}

export function normalizeUserContacts(emailInput, phoneInput) {
  const emailResult = optionalText(emailInput, 'البريد الإلكتروني');
  if (emailResult.error) return emailResult;
  const phoneResult = optionalText(phoneInput, 'رقم الهاتف');
  if (phoneResult.error) return phoneResult;

  const email = emailResult.value?.toLowerCase() ?? null;
  const phone = phoneResult.value ?? null;

  if (!email && !phone) return { error: 'يجب إدخال البريد الإلكتروني أو رقم الهاتف' };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: 'صيغة البريد الإلكتروني غير صحيحة' };
  }
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[0-9\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
      return { error: 'رقم الهاتف غير صحيح؛ استخدم من 7 إلى 15 رقمًا' };
    }
  }
  return { email, phone };
}

export function validateUserCreate(input = {}) {
  if (typeof input.full_name !== 'string' || !input.full_name.trim()) {
    return { error: 'اسم المستخدم مطلوب' };
  }
  if (typeof input.password !== 'string' || input.password.length < 10) {
    return { error: 'كلمة المرور يجب ألا تقل عن 10 أحرف' };
  }
  if (!ALLOWED_ROLES.has(input.role)) return { error: 'دور المستخدم غير صحيح' };
  const contacts = normalizeUserContacts(input.email, input.phone);
  if (contacts.error) return contacts;
  if (input.role === 'class_servant' && (typeof input.class_id !== 'string' || !input.class_id.trim())) {
    return { error: 'يجب ربط خادم الفصل بفصل واحد' };
  }
  if (input.can_record_attendance !== undefined && typeof input.can_record_attendance !== 'boolean') {
    return { error: 'قيمة صلاحية تسجيل الحضور غير صحيحة' };
  }
  return {
    value: {
      full_name: input.full_name.trim(),
      password: input.password,
      role: input.role,
      class_id: input.class_id?.trim() || null,
      can_record_attendance: input.role === 'class_servant' && input.can_record_attendance === true,
      ...contacts
    }
  };
}

export function validateUserPatch(input = {}, existing = {}) {
  if (input.role !== undefined && !ALLOWED_ROLES.has(input.role)) {
    return { error: 'دور المستخدم غير صحيح' };
  }
  if (input.full_name !== undefined && (typeof input.full_name !== 'string' || !input.full_name.trim())) {
    return { error: 'اسم المستخدم مطلوب' };
  }
  if (input.password !== undefined && input.password !== '' &&
      (typeof input.password !== 'string' || input.password.length < 10)) {
    return { error: 'كلمة المرور يجب ألا تقل عن 10 أحرف' };
  }
  if (input.can_record_attendance !== undefined && typeof input.can_record_attendance !== 'boolean') {
    return { error: 'قيمة صلاحية تسجيل الحضور غير صحيحة' };
  }
  if (input.class_id !== undefined && (typeof input.class_id !== 'string' || !input.class_id.trim())) {
    return { error: 'معرّف الفصل غير صحيح' };
  }

  const contacts = normalizeUserContacts(
    input.email === undefined ? existing.email : input.email,
    input.phone === undefined ? existing.phone : input.phone
  );
  if (contacts.error) return contacts;

  return {
    value: {
      ...contacts,
      full_name: input.full_name === undefined ? undefined : input.full_name.trim(),
      role: input.role,
      password: input.password,
      can_record_attendance: input.can_record_attendance
    }
  };
}
