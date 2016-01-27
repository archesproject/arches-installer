var $ = require('jquery');
var _ = require('underscore');
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
    name: 'GEOS',
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
    name: 'Python 2.7.6',
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
    name: 'Java (JDK)',
    versionCmd: 'java -version',
    parseVersion: function (stdout, stderr) {
      if (stderr && stderr.split('java version')[1]) {
        var versionInfo = stderr.split('"')[1].split('.');
        return (versionInfo[0]==='1' && versionInfo[1]==='7');
      }
      return false;
    }
});

vm.dependencies = [vm.python, vm.geos, vm.java];
vm.dependencyCheckRunning = ko.observable(false);
vm.checkDependencies = function () {
    var currentIndex = 0;
    vm.dependencyCheckRunning(true);
    for (var i = 0; i < vm.dependencies.length; i++) {
        vm.dependencies[i].checked(false);
    }
    setTimeout(function () {
        var check = function () {
            if (currentIndex < vm.dependencies.length) {
                vm.dependencies[currentIndex].check(check);
                currentIndex += 1;
            } else {
                vm.dependencyCheckRunning(false);
            }
        };
        check();
    }, 1000);
};
vm.checkDependencies()

var envPathStr = localStorage.getItem('envPath');
vm.envPath = ko.observable(envPathStr ? envPathStr : '');
vm.envPath.subscribe(function(newValue) {
    localStorage.setItem('envPath', newValue);
});
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

vm.tabs = [];
var tabDefaults = function () {
    return {
        index: vm.tabs.length,
        getPrevious: function () {
            if (this.index > 0){
                return vm.tabs[this.index-1];
            }
            return null;
        },
        activateTab: function () {
            for (var i = 0; i < vm.tabs.length; i++) {
                vm.tabs[i].active(false);
            }
            this.active(true);;
        }
    }
};
vm.tabs.push(
    new tab(_.extend({
        active: true,
        title: 'Dependencies',
        description: 'Check for Arches dependencies',
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
        }
    }, tabDefaults()))
);
vm.tabs.push(
    new tab(_.extend({
        title: 'Database',
        description: 'Configure Arches database connection',
        tabLink: '#db-tab',
        readyModel: vm.postgres
    }, tabDefaults()))
);
vm.tabs.push(
    new tab(_.extend({
        title: 'Framework',
        description: 'Install the Arches framework',
        tabLink: '#framework-tab',
        readyModel: {
            ready: vm.installArches.success
        }
    }, tabDefaults()))
);
vm.tabs.push(
    new tab(_.extend({
        title: 'Select Application',
        description: 'Select an Arches application',
        tabLink: '#select-tab'
    }, tabDefaults()))
);
vm.tabs.push(
    new tab(_.extend({
        title: 'Install Application',
        description: 'Install Arches application',
        tabLink: '#install-tab'
    }, tabDefaults()))
);
vm.tabs.push(
    new tab(_.extend({
        title: 'Web Server',
        description: 'Run or configure Arches web server',
        tabLink: '#web-tab'
    }, tabDefaults()))
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

vm.nextTab = function () {
    var active = vm.getActiveTab();
    if (active.index < vm.tabs.length-1) {
        vm.tabs[active.index+1].activateTab();
    }
};

ko.applyBindings(vm);
