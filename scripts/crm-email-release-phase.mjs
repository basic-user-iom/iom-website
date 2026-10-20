// Build-only phase. No runtime authorization or database flag is changed here.
export function emailReleasePhase(value='ACTIVE') {
  if(!['PREPARED','ACTIVE'].includes(value))throw new Error('invalid_crm_email_release_phase')
  return value
}
export function requestedEmailReleasePhase(argv,scopes) {
  const values=[]
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--crm-email-access-phase')values.push(argv[++i])
    else if(argv[i].startsWith('--crm-email-access-phase='))values.push(argv[i].slice('--crm-email-access-phase='.length))
  }
  if(values.length>1)throw new Error('duplicate_crm_email_release_phase')
  if(values.length && (scopes.length!==1||scopes[0]!=='crm-email'))throw new Error('crm_email_phase_requires_exclusive_scope')
  if(values.length && values[0]===undefined)throw new Error('missing_crm_email_release_phase')
  return emailReleasePhase(values.length?values[0]:'ACTIVE')
}
