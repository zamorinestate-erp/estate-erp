'use strict';

const {
  Attendance,
  ATTENDANCE_STATUSES,
} = require('./Attendance');

const {
  Cafe,
} = require('../../models/Cafe');

const {
  SequenceCounter,
} = require('../../models/SequenceCounter');

const {
  asyncHandler,
} = require('../../utils/asyncHandler');

const {
  ApiError,
} = require('../../utils/ApiError');

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

  return Math.min(
    parsedValue,
    maximum
  );
}

function ensureCafeAccess(
  request,
  cafeId
) {
  if (request.auth.role === 'MASTER') {
    return;
  }

  if (
    !request.auth.assignedCafeIds.includes(
      cafeId
    )
  ) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

async function validateOperationalCafe(
  request,
  cafeId
) {
  ensureCafeAccess(
    request,
    cafeId
  );

  const cafe = await Cafe.findOne({
    organisationId:
      request.auth.organisationId,
    cafeId,
    status: 'ACTIVE',
    archivedAt: null,
  });

  if (!cafe) {
    throw new ApiError(
      404,
      'ACTIVE_CAFE_NOT_FOUND',
      'An active café was not found.'
    );
  }

  return cafe;
}

function buildAttendanceFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,
  };

  if (request.auth.role === 'STAFF') {
    filter.userId =
      request.auth.userId;
  }

  if (
    request.auth.role ===
    'CAFE_ADMIN'
  ) {
    filter.cafeId = {
      $in:
        request.auth.assignedCafeIds ||
        [],
    };
  }

  const cafeId =
    normalizeIdentifier(
      request.query.cafeId
    );

  if (cafeId) {
    ensureCafeAccess(
      request,
      cafeId
    );

    filter.cafeId = cafeId;
  }

  const userId =
    normalizeIdentifier(
      request.query.userId
    );

  if (userId) {
    if (
      request.auth.role === 'STAFF' &&
      userId !== request.auth.userId
    ) {
      throw new ApiError(
        403,
        'SELF_ACCESS_ONLY',
        'Staff may view only their own attendance.'
      );
    }

    filter.userId = userId;
  }

  const businessDate =
    typeof request.query.businessDate ===
      'string'
      ? request.query.businessDate.trim()
      : '';

  if (businessDate) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        businessDate
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_BUSINESS_DATE',
        'businessDate must use YYYY-MM-DD format.'
      );
    }

    filter.businessDate =
      businessDate;
  }

  const status =
    normalizeIdentifier(
      request.query.status
    );

  if (status) {
    if (
      !ATTENDANCE_STATUSES.includes(
        status
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_ATTENDANCE_STATUS',
        'The attendance status is invalid.'
      );
    }

    filter.status = status;
  }

  return filter;
}

const listAttendance = asyncHandler(
  async (request, response) => {
    const page =
      parsePositiveInteger(
        request.query.page,
        1,
        100000
      );

    const limit =
      parsePositiveInteger(
        request.query.limit,
        25,
        100
      );

    const filter =
      buildAttendanceFilter(request);

    const skip =
      (page - 1) * limit;

    const [
      attendanceRecords,
      total,
    ] = await Promise.all([
      Attendance.find(filter)
        .sort({
          businessDate: -1,
          checkInAt: -1,
        })
        .skip(skip)
        .limit(limit),

      Attendance.countDocuments(
        filter
      ),
    ]);

    return response.status(200).json({
      success: true,
      data: {
        attendanceRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(total / limit),
        },
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const getTodayAttendance = asyncHandler(
  async (request, response) => {
    const businessDate =
      getIstBusinessDate();

    const attendance =
      await Attendance.findOne({
        organisationId:
          request.auth.organisationId,
        userId:
          request.auth.userId,
        businessDate,
      });

    return response.status(200).json({
      success: true,
      data: {
        businessDate,
        attendance,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const checkIn = asyncHandler(
  async (request, response) => {
    const cafeId =
      normalizeIdentifier(
        request.body?.cafeId
      );

    if (!cafeId) {
      throw new ApiError(
        400,
        'CAFE_ID_REQUIRED',
        'A café ID is required.'
      );
    }

    await validateOperationalCafe(
      request,
      cafeId
    );

    const now = new Date();

    const businessDate =
      getIstBusinessDate(now);

    const existingAttendance =
      await Attendance.findOne({
        organisationId:
          request.auth.organisationId,
        userId:
          request.auth.userId,
        businessDate,
      });

    if (existingAttendance) {
      throw new ApiError(
        409,
        'ATTENDANCE_ALREADY_EXISTS',
        'Attendance already exists for today.'
      );
    }

    const datePart =
      businessDate.replaceAll(
        '-',
        ''
      );

    const attendanceId =
      await SequenceCounter.generateId({
        organisationId:
          request.auth.organisationId,
        sequenceKey:
          `ATTENDANCE_${datePart}`,
        prefix:
          `AT-${datePart}`,
        minimumDigits: 4,
      });

    const attendance =
      await Attendance.create({
        attendanceId,
        organisationId:
          request.auth.organisationId,
        cafeId,
        userId:
          request.auth.userId,
        businessDate,
        status: 'CHECKED_IN',
        checkInAt: now,
        checkInSource: 'SELF',
        checkInRecordedBy:
          request.auth.userId,
        timezone: 'Asia/Kolkata',
        createdBy:
          request.auth.userId,
        updatedBy:
          request.auth.userId,
      });

    return response.status(201).json({
      success: true,
      message:
        'Check-in recorded successfully.',
      data: {
        attendance,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const checkOut = asyncHandler(
  async (request, response) => {
    const businessDate =
      getIstBusinessDate();

    const attendance =
      await Attendance.findOne({
        organisationId:
          request.auth.organisationId,
        userId:
          request.auth.userId,
        businessDate,
        status: 'CHECKED_IN',
      });

    if (!attendance) {
      throw new ApiError(
        404,
        'ACTIVE_ATTENDANCE_NOT_FOUND',
        'No active check-in was found for today.'
      );
    }

    attendance.checkOutAt =
      new Date();

    attendance.checkOutSource =
      'SELF';

    attendance.checkOutRecordedBy =
      request.auth.userId;

    attendance.status =
      'CHECKED_OUT';

    attendance.updatedBy =
      request.auth.userId;

    await attendance.save();

    return response.status(200).json({
      success: true,
      message:
        'Check-out recorded successfully.',
      data: {
        attendance,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  listAttendance,
  getTodayAttendance,
  checkIn,
  checkOut,
};