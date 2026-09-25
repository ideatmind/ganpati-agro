import {RegistrationPage} from '@/features/registration/server/RegistrationPage';
export const metadata={title:'Farmer registration'};
export default function RegisterPage({searchParams}:{searchParams:Promise<{ref?:string|string[]}>}){
 return <RegistrationPage type="standard" searchParams={searchParams}/>;
}
