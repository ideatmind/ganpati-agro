'use client';
import type {InputHTMLAttributes} from 'react';
import {normalizePersonName,personNameSchema} from '@/shared/person-name';
export function PersonNameInput(props:InputHTMLAttributes<HTMLInputElement>){
 return <input {...props} minLength={2} maxLength={200} required={props.required??true}
  onChange={event=>{event.currentTarget.setCustomValidity('');props.onChange?.(event);}}
  onBlur={event=>{const input=event.currentTarget;input.value=normalizePersonName(input.value);input.setCustomValidity(personNameSchema.safeParse(input.value).success?'':'Enter a name using letters, spaces, apostrophes, hyphens or initials. / योग्य पूर्ण नाव लिहा.');props.onBlur?.(event);}}/>;
}
