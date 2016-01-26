var $ = require('jquery');
var jQuery = $;
var ko = require('knockout');
var shell = require('shell');
var path = require('path');
var dialog = require('electron').remote.dialog;
require('pace');
require('bootstrap');
require('fastclick');
require('switchery');
require('bootstrap-select');
require('./plugins/bootstrap-wizard/jquery.bootstrap.wizard.min')
require('chosen');
var dependency = require('./models/dependency');
var postgres = require('./models/postgres');
var command = require('./models/command');
var CommandRunner = require('./models/command-runner');
var tab = require('./models/tab');

var vm = {};
vm.showSplash = ko.observable(true);
vm.showDependencies = ko.observable(false);
vm.showInstaller = ko.observable(false);
vm.postgres = new postgres();
vm.postgres.testConnection();

vm.openExternal = shell.openExternal;
vm.currentStep = ko.observable(0);
vm.geos = new dependency({
    versionCmd: process.platform==='win32' ? 'IF EXIST C:/OSGeo4W64/bin/geos_c.dll ECHO True' : 'geos-config --version',
    parseVersion: function (stdout) {
      if (String(stdout).trim()==="True") {
        return true;
      }
      else{
        return stdout.split('.')[0]==='3'
      }
    }
});

vm.python = new dependency({
    versionCmd: 'python --version',
    // python incorrectly sends version string to stderr...
    parseVersion: function (stdout, stderr) {
        if (stderr && stderr.split('Python ')[1]) {
            var versionInfo = stderr.split('Python ')[1].split('.');
            return (versionInfo[0]==='2' && versionInfo[1]==='7');
        }
        return false;
    }
});

vm.java = new dependency({
    versionCmd: 'java -version',
    parseVersion: function (stdout, stderr) {
      if (stderr && stderr.split('java version')[1]) {
        var versionInfo = stderr.split('"')[1].split('.');
        return (versionInfo[0]==='1' && versionInfo[1]==='7');
      }
      return false;
    }
});

var getPrevious = function () {
    if (this.index > 0){
        return vm.tabs[this.index-1];
    }
    return null;
};
var activateTab = function () {
    for (var i = 0; i < vm.tabs.length; i++) {
        vm.tabs[i].active(false);
    }
    this.active(true);;
};
vm.dependencies = [vm.geos, vm.python, vm.java];
vm.tabs = [];
vm.tabs.push(
    new tab({
        index: 0,
        active: true,
        title: 'Dependencies',
        instructions: 'instructions',
        description: 'Check for Arches dependencies',
        helpLink: 'helpLink',
        tabLink: '#depend-tab',
        readyModel: {
            ready: ko.computed(function () {
                for (var i = 0; i < vm.dependencies.length; i++) {
                    if (!vm.dependencies[i].ready()) {
                        return false;
                    }
                }
                return true;
            })
        },
        getPrevious: getPrevious,
        activateTab: activateTab
    })
);
vm.tabs.push(
    new tab({
        index: 1,
        title: 'Database',
        instructions: 'instructions',
        description: 'description',
        helpLink: 'helpLink',
        tabLink: '#db-tab',
        readyModel: vm.postgres,
        getPrevious: getPrevious,
        activateTab: activateTab
    })
);
vm.tabs.push(
    new tab({
        index: 2,
        title: 'Framework',
        instructions: 'instructions',
        description: 'description',
        helpLink: 'helpLink',
        tabLink: '#framework-tab',
        readyModel: null,
        getPrevious: getPrevious,
        activateTab: activateTab
    })
);
vm.getActiveTab = ko.computed(function () {
    var activeTab = vm.tabs[0];
    for (var i = 0; i < vm.tabs.length; i++) {
        if (vm.tabs[i].active()) {
            activeTab = vm.tabs[i];
        }
    }
    return activeTab;
});

var stepModels = [vm.postgres, vm.geos, vm.python, vm.java];

var stepCount = stepModels.length;
vm.finalStep = ko.computed(function () {
    return (vm.currentStep() === stepCount-1);
});

vm.stepProgress = ko.computed(function () {
    var width = 100/stepCount;
    return {
        width: width + '%',
        left: width * vm.currentStep() + '%'
    };
});

vm.enableNext = ko.computed(function () {
    var step = vm.currentStep();
    return stepModels[step].ready();
});

vm.envPath = ko.observable(false);
vm.getEnvPath = function () {
    var dir = dialog.showOpenDialog({ properties: [ 'openDirectory', 'createDirectory' ]});
    if (dir) {
        vm.envPath(dir[0]);
    }
};


vm.installArches = new CommandRunner([
    new command({
        description: 'Installing pip',
        command: 'python ' + path.normalize('assets/scripts/get-pip.py'),
        sudo: process.platform!=='win32'
    }),
    new command({
        description: 'Installing virtualenv',
        command: 'python -m pip install virtualenv==1.11.4',
        sudo: process.platform!=='win32'
    }),
    new command({
        description: 'Creating virtual environment',
        getCommand: function () {
            return 'python -m virtualenv "' + vm.envPath() + '"';
        }
    }),
    new command({
        description: 'Installing arches',
        getCommand: function () {
            var folder = 'bin';
            var prefix = 'source ';
            if (process.platform === 'win32') {
                folder = 'Scripts';
                prefix = '';
            }
            return prefix + '"' + path.join(vm.envPath(), folder, 'activate') + '"' + ' && pip install arches';
        }
    })
]);

ko.applyBindings(vm);
