import {RegistrationPage} from '@/features/registration/server/RegistrationPage';
export const metadata={title:'Focused Value Chain Membership Form'};
export default function FocusedMembershipPage({searchParams}:{searchParams:Promise<{ref?:string|string[]}>}){
 return <RegistrationPage type="focused_value_chain" searchParams={searchParams}/>;
}
