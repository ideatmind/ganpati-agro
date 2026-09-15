'use client';
import {useFormStatus} from 'react-dom';
export function AdminFilterSubmit(){const {pending}=useFormStatus();return <button className="admin-button" type="submit" disabled={pending} aria-live="polite">{pending?'Applying…':'Apply'}</button>;}
