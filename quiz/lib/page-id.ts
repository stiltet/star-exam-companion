// A reading's page id as saved in progress and in the private store: the 24-digit hex id of a Google bundle page,
// or the plain number a capture makes from a lesson address or a 64-bit hash, which is at most 20 digits.
// One definition, so the store and the saved progress can never disagree about which ids are valid.
export const MAX_PAGE_ID_DIGITS = 20
export const PRIVATE_PAGE_ID = new RegExp(`^[0-9]{1,${MAX_PAGE_ID_DIGITS}}$`)
