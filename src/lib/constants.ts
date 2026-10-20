export const MAX_BENEFICIARIES = 16;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const STEPS = ["Institution", "Nominating Officer", "Focal Person", "Beneficiaries", "Nomination Letter", "Review & Submit"] as const;
export const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"] as const;
export const TYPES = ["University","Polytechnic","College of Education"] as const;
export const ZONES = ["North Central","North East","North West","South East","South South","South West"] as const;
export const PERSON_FIELDS = [
  ["name","Full Name","text"], ["desig","Designation","text"],
  ["email","Official Email Address","email"], ["wa","WhatsApp Number","tel"]
] as const;
export const BENEFICIARY_FIELDS = [
  ["name","Full Name","text"], ["staffId","Staff ID / Staff Number","text"],
  ["dept","Department","text"], ["desig","Designation","text"],
  ["email","Official Email Address","email"], ["wa","WhatsApp Number","tel"]
] as const;
