import type {ReactNode} from 'react';
export function AdminPageHeading({title,description,context,children}:{title:string;description?:ReactNode;context?:string;children?:ReactNode}){
 return <header className="admin-page-heading"><div>{context&&<span className="admin-kicker">{context}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</header>;
}
