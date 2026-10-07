from pathlib import Path
import subprocess
import apply_arg_v4 as v4

OLD = 'finalDate = giftedMemoryDate || (z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear());'
NEW = 'finalDate = z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear();'
strict_once = v4.once

def checked_once(source, old, new):
    if old == OLD and new == NEW:
        count = source.count(old)
        if count != 2:
            raise RuntimeError('Expected exactly two completion-date assignments; found ' + str(count))
        return source.replace(old, new, 2)
    return strict_once(source, old, new)

v4.once = checked_once

if __name__ == '__main__':
    app = Path('js/app.js')
    source = app.read_text(encoding='utf-8')
    if 'var selectedSaut=null,arrivalSaut=null;' in source:
        print('ARG v4 already applied')
        raise SystemExit(0)
    if v4.blob(source) != '0756c39c0eb97aba170b81aab4d0587295880f75':
        raise RuntimeError('Version changed; refusing to overwrite')
    result = v4.patch(source)
    temporary = Path('js/.arg-v4-check.js')
    try:
        temporary.write_text(result, encoding='utf-8')
        subprocess.run(['node', '--check', str(temporary)], check=True)
    finally:
        temporary.unlink(missing_ok=True)
    app.write_text(result, encoding='utf-8')
    print('ARG v4 applied; both completion-date paths fixed; personal JSON and photos unchanged')
