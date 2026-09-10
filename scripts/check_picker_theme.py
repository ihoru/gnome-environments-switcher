"""Opt-in regression: render actual picker widgets in a disposable GNOME session.

Requires GNOME Shell 46, Yaru light/dark themes, GJS, and dbus-run-session.
All settings, extension files, logs, and test output stay in a temporary directory.
No extension is installed in or enabled on the user's normal desktop.
"""
import os,pathlib,tempfile,subprocess,json,sys
root=pathlib.Path(tempfile.mkdtemp(prefix='picker-theme-'))
for d in ['data','config','cache','runtime','state']: (root/d).mkdir(mode=0o700)
ext=root/'data/gnome-shell/extensions/theme-test@local';ext.mkdir(parents=True)
(ext/'metadata.json').write_text(json.dumps({'uuid':'theme-test@local','name':'Theme test','description':'Temporary isolated theme test','shell-version':['46']}))
source=pathlib.Path(__file__).resolve().parents[1]/'src'
for name in ['workspacePicker.js','miniPicker.js']:(ext/name).write_text((source/name).read_text())
(ext/'extension.js').write_text('''import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {WorkspacePicker} from './workspacePicker.js';
import {MiniPicker} from './miniPicker.js';
export default class Test {
 enable(){GLib.timeout_add(GLib.PRIORITY_DEFAULT,1500,()=>{Main.overview.hide();GLib.timeout_add(GLib.PRIORITY_DEFAULT,700,()=>{this.run();return GLib.SOURCE_REMOVE;});return GLib.SOURCE_REMOVE;});}
 disable(){}
 run(){
 const results=[];
 const tc=St.ThemeContext.get_for_stage(global.stage);const old=tc.get_theme();
 const ext={_workspacesPerContext:1,_activeWorkspaceIndex:()=>0,_getWorkspaceByIndex:()=>({list_windows:()=>[]}),_environmentName:c=>c,_log(){}};
 try {
 for(const theme of ['Yaru','Yaru-dark']) {
 tc.set_theme(new St.Theme({application_stylesheet:Gio.File.new_for_path('/usr/share/gnome-shell/theme/'+theme+'/gnome-shell.css')}));
 const picker=Object.create(WorkspacePicker.prototype);picker._extension=ext;picker._tiles=[];picker._nameLabels=[];
 const {panel}=picker._buildMonitor(Main.layoutManager.monitors[0]);Main.uiGroup.add_child(panel);
 const mini=new MiniPicker(ext);mini._startAutoHide=()=>{};mini.show('personal',0);
 const panels=[panel,mini._frames[0].get_child()];
 for(const [i,p] of panels.entries()) {
 const bg=p.get_theme_node().get_background_color();
 const label=i===0?panel.get_first_child():mini._nameLabels[0].label;
 const fg=label.get_theme_node().get_foreground_color();
 const lum=c=>[c.red,c.green,c.blue].map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4}).reduce((v,x,j)=>v+x*[0.2126,0.7152,0.0722][j],0);
 const a=lum(bg),b=lum(fg),contrast=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 results.push(theme+' '+(i?'Preview':'Picker')+' background='+bg.to_string()+' text='+fg.to_string()+' contrast='+contrast.toFixed(2));
 if(contrast<4.5)throw new Error('Insufficient label contrast');
 }
 panel.destroy();mini.destroy();
 }
 results.push('PASS');
 }catch(e){results.push('FAIL '+e.message);}finally{tc.set_theme(old);GLib.file_set_contents(GLib.getenv('THEME_RESULT'),results.join('\\n'));}
 }
}''')
env=os.environ.copy()
for d in ['data','config','cache','runtime','state']:env['XDG_RUNTIME_DIR' if d=='runtime' else 'XDG_'+d.upper()+'_HOME']=str(root/d)
env.update(GSETTINGS_BACKEND='keyfile',THEME_RESULT=str(root/'result'),LIBGL_ALWAYS_SOFTWARE='1')
script='''gsettings set org.gnome.shell enabled-extensions "['theme-test@local']"
gsettings set org.gnome.shell disable-user-extensions false
gnome-shell --mode=user --wayland --headless --virtual-monitor=1280x800 --no-x11 >"$THEME_RESULT.shell" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for i in $(seq 1 150); do [ -f "$THEME_RESULT" ] && break; sleep .1; done
'''
subprocess.run(['dbus-run-session','--','bash','-c',script],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=25)
print(root)
print((root/'result').read_text() if (root/'result').exists() else (root/'result.shell').read_text()[-4000:])

sys.exit(0 if (root/'result').exists() and (root/'result').read_text().endswith('PASS') else 1)
