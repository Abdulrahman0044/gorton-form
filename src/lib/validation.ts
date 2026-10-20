import { z } from "zod";
import { STATES, TYPES, ZONES, MAX_BENEFICIARIES } from "./constants";
const required = (max: number) => z.string().trim().min(1,"Required field").max(max);
const email = z.string().trim().email("Enter a valid email address").max(254).transform(v=>v.toLowerCase());
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{10,18}$/,"Enter a valid WhatsApp phone number");
const person = z.object({ name: required(150), desig: required(150), email, wa: phone }).strict();
const beneficiary = person.extend({ staffId: required(80), dept: required(150) });
export const submissionSchema = z.object({
  clientSubmissionId: z.string().uuid(),
  inst: z.object({
    name: required(200), type: z.enum(TYPES), state: z.enum(STATES), email, zone:z.enum(ZONES)
  }).strict(),
  focal: person, officer: person,
  bene: z.array(beneficiary).length(MAX_BENEFICIARIES),
  confirm: z.literal(true)
}).strict().superRefine((data,ctx)=>{
  const ids = new Set<string>();
  for (let i=0; i<data.bene.length;i++) {
    const staffId=data.bene[i].staffId.trim().toLowerCase();
    if(ids.has(staffId)) ctx.addIssue({code:z.ZodIssueCode.custom,path:["bene",i,"staffId"],message:"Duplicate staff number"});
    ids.add(staffId);
  }
});
export type Submission = z.infer<typeof submissionSchema>;
