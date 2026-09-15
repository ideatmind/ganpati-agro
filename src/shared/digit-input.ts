import type {ClipboardEvent,FormEvent} from 'react';
// Reject a paste containing other characters rather than silently truncating a
// country code or rewriting a government identifier. Server validation remains exact.
export function digitPaste(event:ClipboardEvent<HTMLInputElement>){
 if(!/^[0-9]+$/.test(event.clipboardData.getData('text'))){event.preventDefault();event.currentTarget.setCustomValidity('Use digits only, without spaces or a country code.');event.currentTarget.reportValidity();}
 else event.currentTarget.setCustomValidity('');
}
export function digitBeforeInput(event:FormEvent<HTMLInputElement>){
 const native=event.nativeEvent as InputEvent;
 if(!native.isComposing&&native.data&&!/^[0-9]+$/.test(native.data))event.preventDefault();
 else event.currentTarget.setCustomValidity('');
}
