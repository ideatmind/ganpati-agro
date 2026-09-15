import type {ZodError} from 'zod';
const guidance:Record<string,string>={
 name:'Enter a valid name using letters, spaces, apostrophes, hyphens or initials.',
 mobile:'Enter exactly 10 mobile-number digits, without spaces or a country code.',
 aadhar_no:'Enter exactly 12 Aadhaar digits, without spaces or punctuation.',
 password:'Use at least 8 characters and at most 72 UTF-8 bytes for the password.',
 newPassword:'Use at least 8 characters and at most 72 UTF-8 bytes for the new password.',
 date_of_birth:'Enter a valid date of birth that is not in the future.',
 village:'Enter a village name of up to 200 characters.',district:'Select a district from the list.',taluka:'Select a taluka belonging to the selected district.',
 cluster_type:'Select a cluster from the list.',income_source:'Select an income source from the list.',
 referral_code:'Use a referral code of 6–16 letters or digits, or leave it blank.',
 consent:'Confirm your consent before registering.',plots:'Add between one and ten complete plots.',
 crop_name:'Select a crop belonging to the selected cluster.',area_acres:'Enter acres from 0.01 to 100,000, using at most two decimal places.',
 plot_no:'Enter a plot/survey number of up to 100 characters.',irrigation_source:'Select an irrigation source from the list.',
 fields:'Select at least one permitted field.',durationHours:'Use a grant duration between 1 and 168 hours.',
 amountRupees:'Enter a positive amount with at most two decimal places.',reason:'Enter a reason within the displayed length limit.',
 profileId:'Select a referrer.',employeeId:'Select an employee.',farmerId:'Select a farmer onboarded by that employee.'
};
export function validationFeedback(error:ZodError){
 const path=error.issues[0]?.path??[];const key=String(path.at(-1)??'');
 // Never reflect validator messages, submitted values or arbitrary object keys.
 return guidance[key]?{error:guidance[key],field:path.map(String).join('.')}: {error:'Please check the submitted fields.'};
}
