import { Check, ChevronDown } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

export type SelectMenuOption = { value: string; label: string; description?: string; icon?: ReactNode; disabled?: boolean };

export function SelectMenu({ value, options, onChange, label, disabled, className = "" }: { value: string; options: SelectMenuOption[]; onChange: (value: string) => void; label: string; disabled?: boolean; className?: string }) {
  const [open,setOpen]=useState(false); const root=useRef<HTMLDivElement>(null);
  const selected=options.find(option=>option.value===value)??options[0];
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape)}},[]);
  return <div ref={root} className={`select-menu ${open?"open":""} ${className}`}>
    <button type="button" className="select-menu-trigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(current=>!current)}>
      {selected?.icon&&<span className="select-menu-icon">{selected.icon}</span>}<span className="select-menu-copy"><strong>{selected?.label}</strong>{selected?.description&&<small>{selected.description}</small>}</span><ChevronDown size={15}/>
    </button>
    {open&&<ul className="select-menu-popover" role="listbox" aria-label={label}>{options.map(option=><li key={option.value}><button type="button" role="option" aria-selected={option.value===value} disabled={option.disabled} className={option.value===value?"active":""} onClick={()=>{onChange(option.value);setOpen(false)}}>{option.icon&&<span className="select-menu-icon">{option.icon}</span>}<span className="select-menu-copy"><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>{option.value===value&&<Check size={15}/>}</button></li>)}</ul>}
  </div>;
}
