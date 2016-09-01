import fs from 'fs';
import _ from 'lodash';

import JobInstallerBase from '../job-installer-base';
import {statNoException} from '../promise-array';
import {findActualExecutable, spawnPromise} from 'spawn-rx';

// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeSystemdService =
  _.template(fs.readFileSync(require.resolve('../../src/job-installers/systemd.in'), 'utf8'));

export default class SystemdInstaller extends JobInstallerBase {
  async getAffinityForJob(name, command) {
    if (process.platform !== 'linux') return 0;
    let systemctl = await statNoException('/usr/bin/systemctl');

    return systemctl ? 5 : 0;
  }

  async installJob(name, command, returnContent=false) {
    // NB: systemd requires commands to be have absolute paths
    let [, cmd, params] = command.match(/^(\S+)(.*)/);
    command = findActualExecutable(cmd, []).cmd + params;

    let opts = {
      envs: this.getInterestingEnvVars().map((x) => `${x}=${process.env[x]}`),
      name, command
    };

    let target = `/etc/systemd/system/${name}.service`;

    if (returnContent) {
      return makeSystemdService(opts);
    } else {
      fs.writeFileSync(target, makeSystemdService(opts));
      await spawnPromise('systemctl', ['daemon-reload']);
      await spawnPromise('systemctl', ['enable', name]);
    }

    return `systemd service written to '${target}

To start it: sudo systemctl start ${name}
To run it at system startup: sudo systemctl start ${name}'`;
  }
}
