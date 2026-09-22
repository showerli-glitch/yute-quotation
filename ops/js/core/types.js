/**
 * Shared OPS data contracts documented from the production snapshot schema.
 * These typedefs are documentation only and do not change runtime data.
 *
 * @typedef {Object} OpsCase
 * @property {string} code
 * @property {string} name
 * @property {string} [companyId]
 *
 * @typedef {Object} OpsPayable
 * @property {number|string} id
 * @property {string} [case]
 * @property {number} amount
 * @property {string} status
 * @property {string} [paymentType]
 *
 * @typedef {Object} OpsReceivable
 * @property {number|string} id
 * @property {string} case
 * @property {number} [receivableAmt]
 * @property {number} [collectAmt]
 * @property {string} status
 *
 * @typedef {Object} OpsExpense
 * @property {number|string} id
 * @property {string} person
 * @property {string} month
 * @property {string} caseKey
 * @property {number} amount
 * @property {string} status
 *
 * @typedef {Object} OpsSnapshot
 * @property {'yutesign-ops-backup'} format
 * @property {number} formatVersion
 * @property {string} appVersion
 * @property {string} companyId
 * @property {OpsCase[]} CASES
 * @property {OpsPayable[]} PAYABLES
 * @property {OpsReceivable[]} RECEIVABLES
 * @property {OpsExpense[]} EXPENSES
 * @property {string} savedAt
 */
