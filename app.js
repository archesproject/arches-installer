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

var vm = {};
vm.showSplash = ko.observable(true);
vm.showDependencies = ko.observable(false);
vm.showInstaller = ko.observable(false);
vm.postgres = new postgres();
vm.postgres.testConnection();

vm.openExternal = shell.openExternal;
vm.currentStep = ko.observable(0);
vm.geos = new dependency({
    versionCmd: 'geos-config --version',
    parseVersion: function (stdout) {
        return stdout.split('.')[0]==='3'
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
    versionCmd: 'java -version'
});

var stepCount = $('.depend-tab').length;
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

var stepModels = [vm.postgres, vm.geos, vm.python, vm.java];
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
        sudo: true
    }),
    new command({
        description: 'Installing virtualenv',
        command: 'python -m pip install virtualenv==1.11.4',
        sudo: true
    }),
    new command({
        description: 'Creating virtual environment',
        getCommand: function () {
            return 'python -m virtualenv ' + vm.envPath();
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
            return prefix + path.join(vm.envPath(), folder, 'activate') + ' && pip install arches';
        }
    })
]);

$('#dependencies').bootstrapWizard({
    tabClass: 'wz-steps',
    nextSelector: '.next',
    previousSelector: '.previous',
    onTabClick: function() {
        return false;
    },
    onTabShow: function(tab, navigation, index) {
        vm.currentStep(index);
    }
});

ko.applyBindings(vm);
