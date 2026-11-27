const mongoose = require("mongoose");

/**
 * Build a Mongoose filter matching either ObjectId _id or a custom string code field.
 */
const buildIdOrCodeFilter = (idOrCode, codeField) => {
  if (mongoose.Types.ObjectId.isValid(idOrCode)) {
    return { $or: [{ _id: idOrCode }, { [codeField]: idOrCode }] };
  }
  return { [codeField]: idOrCode };
};

module.exports = { buildIdOrCodeFilter };
