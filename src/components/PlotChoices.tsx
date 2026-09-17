"use client";

import { useId } from "react";

export function PlotChoices({ label, options, values, onChange, name, disabled = false }: {
  label: string;
  options: readonly { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  name: string;
  disabled?: boolean;
}) {
  const id = useId();
  return <fieldset className="plot-choices" disabled={disabled} aria-describedby={`${id}-hint`}>
    <legend>{label} <b aria-hidden="true">*</b></legend>
    <p id={`${id}-hint`} className="plot-choices-hint">{disabled
      ? "आधी समूह निवडा / Select a cluster first."
      : "लागू असलेले सर्व पर्याय निवडा (किमान एक). / Select all that apply (at least one)."}</p>
    {!disabled && <>
      <p className="plot-choices-count" role="status">{values.length} निवडले / selected</p>
      <div className="plot-choices-list">{options.map((option, index) => <label key={option.value}>
        <input type="checkbox" name={index === 0 ? name : `${name}.${index}`} value={option.value}
          checked={values.includes(option.value)} required={index === 0 && values.length === 0}
          onChange={event => onChange(event.target.checked ? [...values, option.value] : values.filter(value => value !== option.value))}/>
        <span>{option.label}</span>
      </label>)}</div>
      {values.length > 0 && <p className="plot-choices-summary">{values.map(value => options.find(option => option.value === value)?.label ?? value).join(" · ")}</p>}
    </>}
  </fieldset>;
}
