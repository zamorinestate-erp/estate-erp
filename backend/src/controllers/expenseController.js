'use strict';

const {
  Expense,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
} = require('../models/Expense');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

// Safe whitelist for client-supplied sort field names.
// Values must match Mongoose field names exactly (camelCase).
const ALLOWED_SORT_FIELDS = new Set([
  'createdAt',
  'businessDate',
  'amount',
  'submittedAt',
  'decisionAt',
]);

// ─── Shared helpers (mirror of convention used in cashController) ──────────────

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function escapeRegExp(text) {
  return text.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

// ─── Scope helpers ─────────────────────────────────────────────────────────────

function ensureCafeAccess(request, cafeId) {
  if (
    request.auth.role === 'MASTER' ||
    request.auth.role === 'OWNER'
  ) {
    return;
  }

  if (
    !(
      request.auth.assignedCafeIds || []
    ).includes(cafeId)
  ) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this cafe.'
    );
  }
}

// ─── Filter builder ────────────────────────────────────────────────────────────

function buildExpenseFilter(request) {
  const {
    role,
    organisationId,
    userId,
    assignedCafeIds,
  } = request.auth;

  // Organisation scope is always derived from the authenticated user — never
  // accepted from client input.
  const filter = { organisationId };

  // STAFF: own expenses only, within assigned cafes
  if (role === 'STAFF') {
    filter.createdBy = userId;
    filter.cafeId = {
      $in: assignedCafeIds || [],
    };
  }

  // CAFE_ADMIN: assigned cafes only
  if (role === 'CAFE_ADMIN') {
    filter.cafeId = {
      $in: assignedCafeIds || [],
    };
  }

  // -- cafeId query filter --
  const cafeId = normalizeIdentifier(
    request.query.cafeId
  );

  if (cafeId) {
    ensureCafeAccess(request, cafeId);
    // Narrow the scope -- may replace the $in set with a single value
    filter.cafeId = cafeId;
  }

  // -- businessDate / dateFrom / dateTo --
  const businessDate =
    typeof request.query.businessDate === 'string'
      ? request.query.businessDate.trim()
      : '';

  const dateFrom =
    typeof request.query.dateFrom === 'string'
      ? request.query.dateFrom.trim()
      : '';

  const dateTo =
    typeof request.query.dateTo === 'string'
      ? request.query.dateTo.trim()
      : '';

  if (businessDate) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
    ) {
      throw new ApiError(
        400,
        'INVALID_BUSINESS_DATE',
        'businessDate must use YYYY-MM-DD format.'
      );
    }

    filter.businessDate = businessDate;
  } else if (dateFrom || dateTo) {
    if (
      dateFrom &&
      !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
    ) {
      throw new ApiError(
        400,
        'INVALID_DATE_FROM',
        'dateFrom must use YYYY-MM-DD format.'
      );
    }

    if (
      dateTo &&
      !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
    ) {
      throw new ApiError(
        400,
        'INVALID_DATE_TO',
        'dateTo must use YYYY-MM-DD format.'
      );
    }

    const dateRange = {};

    if (dateFrom) {
      dateRange.$gte = dateFrom;
    }

    if (dateTo) {
      dateRange.$lte = dateTo;
    }

    filter.businessDate = dateRange;
  }

  // -- status filter --
  const status = normalizeIdentifier(
    request.query.status
  );

  if (status) {
    if (!EXPENSE_STATUSES.includes(status)) {
      throw new ApiError(
        400,
        'INVALID_EXPENSE_STATUS',
        'The expense status is invalid.'
      );
    }

    filter.status = status;
  }

  // -- category filter --
  const category = normalizeIdentifier(
    request.query.category
  );

  if (category) {
    filter.category = category;
  }

  // -- paymentMethod filter --
  const paymentMethod = normalizeIdentifier(
    request.query.paymentMethod
  );

  if (paymentMethod) {
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ApiError(
        400,
        'INVALID_PAYMENT_METHOD',
        'The payment method is invalid.'
      );
    }

    filter.paymentMethod = paymentMethod;
  }

  // -- createdBy filter --
  const createdBy = normalizeIdentifier(
    request.query.createdBy
  );

  if (createdBy) {
    if (
      role === 'STAFF' &&
      createdBy !== userId
    ) {
      throw new ApiError(
        403,
        'SELF_ACCESS_ONLY',
        'Staff may filter only by their own user ID.'
      );
    }

    filter.createdBy = createdBy;
  }

  // -- free-text search --
  const search =
    typeof request.query.search === 'string'
      ? request.query.search.trim()
      : '';

  if (search) {
    const safePattern = escapeRegExp(search);

    filter.$or = [
      {
        description: {
          $regex: safePattern,
          $options: 'i',
        },
      },
      {
        vendorName: {
          $regex: safePattern,
          $options: 'i',
        },
      },
      {
        invoiceNumber: {
          $regex: safePattern,
          $options: 'i',
        },
      },
      {
        notes: {
          $regex: safePattern,
          $options: 'i',
        },
      },
    ];
  }

  return filter;
}

// ─── Sort resolver ─────────────────────────────────────────────────────────────

function resolveSort(request) {
  const sortBy =
    typeof request.query.sortBy === 'string'
      ? request.query.sortBy.trim()
      : '';

  const sortOrder =
    typeof request.query.sortOrder === 'string'
      ? request.query.sortOrder.trim().toUpperCase()
      : '';

  if (sortBy && ALLOWED_SORT_FIELDS.has(sortBy)) {
    const order =
      sortOrder === 'ASC' ? 1 : -1;

    return { [sortBy]: order, expenseId: -1 };
  }

  // Default: newest first
  return { createdAt: -1, expenseId: -1 };
}

// ─── listExpenses ──────────────────────────────────────────────────────────────

const listExpenses = asyncHandler(
  async (request, response) => {
    const page = parsePositiveInteger(
      request.query.page,
      1,
      100000
    );

    const limit = parsePositiveInteger(
      request.query.limit,
      25,
      100
    );

    const filter = buildExpenseFilter(request);

    const sort = resolveSort(request);

    const skip = (page - 1) * limit;

    const [expenses, total] =
      await Promise.all([
        Expense.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit),

        Expense.countDocuments(filter),
      ]);

    return response.status(200).json({
      success: true,
      data: {
        expenses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── getExpense ────────────────────────────────────────────────────────────────

const getExpense = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    // CAFE_ADMIN scope
    if (role === 'CAFE_ADMIN') {
      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    // STAFF scope: own expenses within assigned cafes only
    if (role === 'STAFF') {
      if (expense.createdBy !== userId) {
        throw new ApiError(
          403,
          'EXPENSE_ACCESS_DENIED',
          'You may only access expenses you created.'
        );
      }

      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    return response.status(200).json({
      success: true,
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── createExpense ─────────────────────────────────────────────────────────────

const createExpense = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    const cafeId = normalizeIdentifier(
      request.body && request.body.cafeId
    );

    if (!cafeId) {
      throw new ApiError(
        400,
        'CAFE_ID_REQUIRED',
        'A cafe ID is required.'
      );
    }

    // Validate cafe access for non-MASTER/OWNER roles
    if (
      role === 'STAFF' ||
      role === 'CAFE_ADMIN'
    ) {
      if (
        !(assignedCafeIds || []).includes(cafeId)
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    const category = normalizeIdentifier(
      request.body && request.body.category
    );

    if (!category) {
      throw new ApiError(
        400,
        'EXPENSE_CATEGORY_REQUIRED',
        'An expense category is required.'
      );
    }

    const description =
      request.body && typeof request.body.description === 'string'
        ? request.body.description.trim()
        : '';

    if (!description) {
      throw new ApiError(
        400,
        'EXPENSE_DESCRIPTION_REQUIRED',
        'An expense description is required.'
      );
    }

    const amount = Number(request.body && request.body.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new ApiError(
        400,
        'INVALID_EXPENSE_AMOUNT',
        'The expense amount must be greater than zero.'
      );
    }

    const paymentMethod = normalizeIdentifier(
      (request.body && request.body.paymentMethod) || 'CASH'
    );

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ApiError(
        400,
        'INVALID_PAYMENT_METHOD',
        'The payment method is invalid.'
      );
    }

    const now = new Date();

    const businessDate = getIstBusinessDate(now);

    const datePart = businessDate.replaceAll(
      '-',
      ''
    );

    const expenseId =
      await SequenceCounter.generateId({
        organisationId,
        sequenceKey: 'EXPENSE_' + datePart,
        prefix: 'EX-' + datePart,
        minimumDigits: 4,
      });

    const expense = await Expense.create({
      expenseId,
      organisationId,
      cafeId,
      businessDate,
      category,
      description,
      amount,
      currency: 'INR',
      paymentMethod,
      vendorName:
        request.body && typeof request.body.vendorName === 'string'
          ? request.body.vendorName.trim()
          : '',
      invoiceNumber:
        normalizeIdentifier(
          request.body && request.body.invoiceNumber
        ) || '',
      receiptUrl:
        request.body && typeof request.body.receiptUrl === 'string'
          ? request.body.receiptUrl.trim()
          : '',
      notes:
        request.body && typeof request.body.notes === 'string'
          ? request.body.notes.trim()
          : '',
      status: 'DRAFT',
      timezone: 'Asia/Kolkata',
      createdBy: userId,
      updatedBy: userId,
    });

    return response.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── updateExpense ─────────────────────────────────────────────────────────────

const updateExpense = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    if (
      !['DRAFT', 'RETURNED'].includes(
        expense.status
      )
    ) {
      throw new ApiError(
        409,
        'EXPENSE_NOT_EDITABLE',
        'Only draft or returned expenses may be edited.'
      );
    }

    // Scope checks
    if (role === 'CAFE_ADMIN') {
      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    if (role === 'STAFF') {
      if (expense.createdBy !== userId) {
        throw new ApiError(
          403,
          'EXPENSE_ACCESS_DENIED',
          'Staff may only edit expenses they created.'
        );
      }

      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    // Apply only the permitted mutable fields
    if (request.body && request.body.category !== undefined) {
      expense.category = normalizeIdentifier(
        request.body.category
      );
    }

    if (
      request.body && request.body.description !== undefined
    ) {
      expense.description =
        typeof request.body.description === 'string'
          ? request.body.description.trim()
          : '';
    }

    if (request.body && request.body.amount !== undefined) {
      const amount = Number(request.body.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new ApiError(
          400,
          'INVALID_EXPENSE_AMOUNT',
          'The expense amount must be greater than zero.'
        );
      }

      expense.amount = amount;
    }

    if (
      request.body && request.body.paymentMethod !== undefined
    ) {
      const paymentMethod = normalizeIdentifier(
        request.body.paymentMethod
      );

      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw new ApiError(
          400,
          'INVALID_PAYMENT_METHOD',
          'The payment method is invalid.'
        );
      }

      expense.paymentMethod = paymentMethod;
    }

    if (request.body && request.body.vendorName !== undefined) {
      expense.vendorName =
        typeof request.body.vendorName === 'string'
          ? request.body.vendorName.trim()
          : '';
    }

    if (
      request.body && request.body.invoiceNumber !== undefined
    ) {
      expense.invoiceNumber = normalizeIdentifier(
        request.body.invoiceNumber
      );
    }

    if (request.body && request.body.receiptUrl !== undefined) {
      expense.receiptUrl =
        typeof request.body.receiptUrl === 'string'
          ? request.body.receiptUrl.trim()
          : '';
    }

    if (request.body && request.body.notes !== undefined) {
      expense.notes =
        typeof request.body.notes === 'string'
          ? request.body.notes.trim()
          : '';
    }

    expense.updatedBy = userId;

    await expense.save();

    return response.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── submitExpense ─────────────────────────────────────────────────────────────

const submitExpense = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    if (
      !['DRAFT', 'RETURNED'].includes(
        expense.status
      )
    ) {
      throw new ApiError(
        409,
        'EXPENSE_NOT_SUBMITTABLE',
        'Only draft or returned expenses may be submitted.'
      );
    }

    // Must be the creator, MASTER, OWNER or authorised CAFE_ADMIN
    if (role === 'CAFE_ADMIN') {
      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    } else if (role === 'STAFF') {
      if (expense.createdBy !== userId) {
        throw new ApiError(
          403,
          'EXPENSE_ACCESS_DENIED',
          'Staff may only submit expenses they created.'
        );
      }

      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    await expense.submit(userId);

    return response.status(200).json({
      success: true,
      message: 'Expense submitted successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── decideExpense ─────────────────────────────────────────────────────────────

const decideExpense = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    if (
      ![
        'MASTER',
        'OWNER',
        'CAFE_ADMIN',
      ].includes(role)
    ) {
      throw new ApiError(
        403,
        'DECISION_ACCESS_DENIED',
        'Only MASTER, OWNER and CAFE_ADMIN may approve, reject or return expenses.'
      );
    }

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    const decision = normalizeIdentifier(
      request.body && request.body.decision
    );

    if (
      ![
        'APPROVED',
        'REJECTED',
        'RETURNED',
      ].includes(decision)
    ) {
      throw new ApiError(
        400,
        'INVALID_EXPENSE_DECISION',
        'The decision must be APPROVED, REJECTED or RETURNED.'
      );
    }

    const reason =
      request.body && typeof request.body.reason === 'string'
        ? request.body.reason.trim()
        : '';

    if (
      ['REJECTED', 'RETURNED'].includes(
        decision
      ) &&
      !reason
    ) {
      throw new ApiError(
        400,
        'DECISION_REASON_REQUIRED',
        'A reason is required for rejected or returned expenses.'
      );
    }

    // CAFE_ADMIN: only for their assigned cafes
    if (role === 'CAFE_ADMIN') {
      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    await expense.recordDecision({
      userId,
      decision,
      reason,
    });

    return response.status(200).json({
      success: true,
      message:
        'Expense decision recorded successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── markExpensePaid ───────────────────────────────────────────────────────────

const markExpensePaid = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      userId,
      assignedCafeIds,
    } = request.auth;

    if (
      ![
        'MASTER',
        'OWNER',
        'CAFE_ADMIN',
      ].includes(role)
    ) {
      throw new ApiError(
        403,
        'PAY_ACCESS_DENIED',
        'Only MASTER, OWNER and CAFE_ADMIN may mark expenses as paid.'
      );
    }

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    if (expense.status !== 'APPROVED') {
      throw new ApiError(
        409,
        'EXPENSE_NOT_APPROVED',
        'Only approved expenses may be marked as paid.'
      );
    }

    if (role === 'CAFE_ADMIN') {
      if (
        !(assignedCafeIds || []).includes(
          expense.cafeId
        )
      ) {
        throw new ApiError(
          403,
          'CAFE_ACCESS_DENIED',
          'You do not have access to this cafe.'
        );
      }
    }

    const paymentReference =
      request.body && typeof request.body.paymentReference === 'string'
        ? request.body.paymentReference
            .trim()
            .toUpperCase()
        : '';

    // paidAt and paidBy come from the backend -- never from the client
    expense.status = 'PAID';
    expense.paidAt = new Date();
    expense.paidBy = userId;
    expense.updatedBy = userId;

    if (paymentReference) {
      expense.paymentReference = paymentReference;
    }

    await expense.save();

    return response.status(200).json({
      success: true,
      message:
        'Expense marked as paid successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── reverseExpense ────────────────────────────────────────────────────────────

const reverseExpense = asyncHandler(
  async (request, response) => {
    const { role, organisationId, userId } =
      request.auth;

    if (role !== 'MASTER') {
      throw new ApiError(
        403,
        'MASTER_ACCESS_REQUIRED',
        'Only the MASTER role may reverse expenses.'
      );
    }

    const expenseId = normalizeIdentifier(
      request.params.expenseId
    );

    const reversalReason =
      request.body && typeof request.body.reversalReason === 'string'
        ? request.body.reversalReason.trim()
        : '';

    if (!reversalReason) {
      throw new ApiError(
        400,
        'REVERSAL_REASON_REQUIRED',
        'A reversal reason is required.'
      );
    }

    const expense = await Expense.findOne({
      organisationId,
      expenseId,
    });

    if (!expense) {
      throw new ApiError(
        404,
        'EXPENSE_NOT_FOUND',
        'The expense was not found.'
      );
    }

    if (expense.status !== 'PAID') {
      throw new ApiError(
        409,
        'EXPENSE_NOT_PAID',
        'Only paid expenses may be reversed.'
      );
    }

    // reversedAt and reversedBy come from the backend -- never from the client
    expense.status = 'REVERSED';
    expense.reversedAt = new Date();
    expense.reversedBy = userId;
    expense.reversalReason = reversalReason;
    expense.updatedBy = userId;

    await expense.save();

    return response.status(200).json({
      success: true,
      message: 'Expense reversed successfully.',
      data: { expense },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── getExpenseSummary ─────────────────────────────────────────────────────────

const getExpenseSummary = asyncHandler(
  async (request, response) => {
    const {
      role,
      organisationId,
      assignedCafeIds,
    } = request.auth;

    if (role === 'STAFF') {
      throw new ApiError(
        403,
        'SUMMARY_ACCESS_DENIED',
        'Staff users cannot access the expense summary.'
      );
    }

    const filter = { organisationId };

    // CAFE_ADMIN: limit to assigned cafes
    if (role === 'CAFE_ADMIN') {
      filter.cafeId = {
        $in: assignedCafeIds || [],
      };
    }

    // -- cafeId scope filter --
    const cafeId = normalizeIdentifier(
      request.query.cafeId
    );

    if (cafeId) {
      ensureCafeAccess(request, cafeId);
      filter.cafeId = cafeId;
    }

    // -- businessDate / dateFrom / dateTo --
    const businessDate =
      typeof request.query.businessDate === 'string'
        ? request.query.businessDate.trim()
        : '';

    const dateFrom =
      typeof request.query.dateFrom === 'string'
        ? request.query.dateFrom.trim()
        : '';

    const dateTo =
      typeof request.query.dateTo === 'string'
        ? request.query.dateTo.trim()
        : '';

    if (businessDate) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
      ) {
        throw new ApiError(
          400,
          'INVALID_BUSINESS_DATE',
          'businessDate must use YYYY-MM-DD format.'
        );
      }

      filter.businessDate = businessDate;
    } else if (dateFrom || dateTo) {
      if (
        dateFrom &&
        !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
      ) {
        throw new ApiError(
          400,
          'INVALID_DATE_FROM',
          'dateFrom must use YYYY-MM-DD format.'
        );
      }

      if (
        dateTo &&
        !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
      ) {
        throw new ApiError(
          400,
          'INVALID_DATE_TO',
          'dateTo must use YYYY-MM-DD format.'
        );
      }

      const dateRange = {};

      if (dateFrom) {
        dateRange.$gte = dateFrom;
      }

      if (dateTo) {
        dateRange.$lte = dateTo;
      }

      filter.businessDate = dateRange;
    }

    const [byStatus, byCategory, byPaymentMethod] =
      await Promise.all([
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
          { $sort: { totalAmount: -1 } },
        ]),

        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$paymentMethod',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
          { $sort: { totalAmount: -1 } },
        ]),
      ]);

    // Compute roll-up totals from the status breakdown
    let totalExpenseCount = 0;
    let totalAmount = 0;
    let approvedAmount = 0;
    let paidAmount = 0;
    let pendingApprovalAmount = 0;
    let reversedAmount = 0;

    byStatus.forEach((item) => {
      totalExpenseCount += item.count;
      totalAmount += item.totalAmount;

      if (item._id === 'APPROVED') {
        approvedAmount = item.totalAmount;
      }

      if (item._id === 'PAID') {
        paidAmount = item.totalAmount;
      }

      if (item._id === 'SUBMITTED') {
        pendingApprovalAmount = item.totalAmount;
      }

      if (item._id === 'REVERSED') {
        reversedAmount = item.totalAmount;
      }
    });

    return response.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalExpenseCount,
        totalAmount,
        approvedAmount,
        paidAmount,
        pendingApprovalAmount,
        reversedAmount,
        byStatus,
        byCategory,
        byPaymentMethod,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  submitExpense,
  decideExpense,
  markExpensePaid,
  reverseExpense,
  getExpenseSummary,
};
