'use strict';
module.exports = {
  PIN_LENGTH: 6,
  // Not exhaustive by design (Section 39 of the login spec: "do not expose
  // the full blocklist to attackers" — this file never ships to a client).
  // Sequential and repeated-digit patterns are also rejected programmatically
  // in operatorPinService.isWeakPin, not just by this literal list.
  BLOCKLIST: new Set([
    '123456', '654321', '000000', '111111', '222222', '333333', '444444',
    '555555', '666666', '777777', '888888', '999999', '012345', '543210',
    '121212', '101010', '123123', '696969', '112233', '007007', '112211',
  ]),
};
