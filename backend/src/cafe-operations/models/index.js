'use strict';
const mongoose = require('mongoose');
const integrationRefs = require('../config/integrationRefs');

const Device = require('./CafeOpsDevice');
const DeviceEnrollmentToken = require('./CafeOpsDeviceEnrollmentToken');
const OperatorCredential = require('./CafeOpsOperatorCredential');
const OperatorAccess = require('./CafeOpsOperatorAccess');
const Session = require('./CafeOpsSession');
const SecurityEvent = require('./CafeOpsSecurityEvent');

// INTEGRATION SEAM — see config/integrationRefs.js. Mongoose's model
// registry is process-global: once your real app registers
// mongoose.model('Employee', EmployeeSchema) anywhere in this same process,
// this lookup finds it with no import cycle needed. Returns null (not a
// throw) when running standalone/in tests, which is expected.
function getExternalEmployeeModel() {
  try { return mongoose.model(integrationRefs.EMPLOYEE_MODEL_NAME); }
  catch (e) { return null; }
}
function getExternalCafeModel() {
  try { return mongoose.model(integrationRefs.CAFE_MODEL_NAME); }
  catch (e) { return null; }
}

module.exports = {
  Device, DeviceEnrollmentToken, OperatorCredential, OperatorAccess, Session, SecurityEvent,
  getExternalEmployeeModel, getExternalCafeModel,
};
