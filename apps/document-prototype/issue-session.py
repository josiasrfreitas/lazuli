import subprocess,json,time
args=['aws','--profile','lazuli','--region','us-east-2']
js="const r=await fetch('http://127.0.0.1:3099/document-prototype/internal/sessions',{method:'POST',headers:{'x-prototype-admin':process.env.PROTOTYPE_ADMIN_SECRET}});console.log(await r.text())"
import shlex
command='docker exec lazuli-document-prototype node --input-type=module -e '+shlex.quote(js)
r=json.loads(subprocess.check_output(args+['ssm','send-command','--instance-ids','i-0597e6be1566e447b','--document-name','AWS-RunShellScript','--parameters',json.dumps({'commands':[command]})]))
id=r['Command']['CommandId']
for _ in range(20):
 time.sleep(1)
 p=subprocess.run(args+['ssm','get-command-invocation','--command-id',id,'--instance-id','i-0597e6be1566e447b'],capture_output=True,text=True)
 if p.returncode: continue
 result=json.loads(p.stdout)
 if result['Status']=='Success':
  session=json.loads(result['StandardOutputContent']);open('/tmp/lazuli-staging-doc-session.json','w').write(json.dumps(session));print('https://staging.lazuli.fisklagarto.com.br/document-prototype/#'+session['token']);break
 if result['Status'] not in ['Pending','InProgress','Delayed']: raise RuntimeError(result['Status'])
else: raise RuntimeError('Poll command '+id)
