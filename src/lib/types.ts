export type Person = { name: string; desig: string; email: string; wa: string };
export type Beneficiary = Person & { staffId: string; dept: string };
export type Institution = { name: string; type: string; state: string; email: string; zone: string };
export type Draft = {
  clientSubmissionId: string;
  step: number;
  stepOrderVersion: number;
  inst: Institution;
  focal: Person;
  officer: Person;
  bene: Beneficiary[];
  confirm: boolean;
};
export const emptyPerson = (): Person => ({ name: "", desig: "", email: "", wa: "" });
export const emptyBeneficiary = (): Beneficiary => ({...emptyPerson(),staffId:"",dept:""});
export const emptyDraft = (): Draft => ({
  clientSubmissionId: "", step: 0, stepOrderVersion: 2,
  inst: { name:"",type:"",state:"",email:"",zone:"" },
  focal:emptyPerson(),officer:emptyPerson(),bene:[emptyBeneficiary()],confirm:false
});
export type LocalReceipt = { reference: string; count: number; submittedAt: string };
