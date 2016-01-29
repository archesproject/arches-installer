var $ = require('jquery');
var _ = require('underscore');
var jQuery = $;
var ko = require('knockout');
var shell = require('shell');
var path = require('path');
var dialog = require('electron').remote.dialog;
var Switchery = require('switchery');
var cp = require('child_process');
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
var application = require('./models/application');
var versionCompare = require('./plugins/utils').versionCompare;

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
    helpURL: 'https://trac.osgeo.org/geos/',
    parseVersion: function (stdout) {
        if (process.platform==='win32') {
            return String(stdout).trim() === "True";
        }
        else {
            this.version(stdout);
            return stdout.split('.')[0]==='3'
        }
    }
});

vm.python = new dependency({
    name: 'Python',
    versionCmd: 'python --version',
    helpURL: 'https://www.python.org/downloads/',
    // python incorrectly sends version string to stderr...
    parseVersion: function (stdout, stderr) {
        if (stderr && stderr.split('Python ')[1]) {
            var versionInfo = stderr.split('Python ')[1];
            this.version(versionInfo);
            if (versionCompare(versionInfo, '2.7.6') < 0){
                this.statusText(' - Arches requires at least python version 2.7.6')
                return false;
            }
            if (versionCompare(versionInfo, '2.7.7') === 0 || 
                versionCompare(versionInfo, '2.7.8') === 0){
                this.statusText(' - Version 2.7.7 and 2.7.8 might not work as expected')
                return false;
            }
            return (versionCompare(versionInfo, '2.7.6') >= 0);
        }
        return false;
    }
});

vm.java = new dependency({
    name: 'Java (JDK)',
    versionCmd: 'java -version',
    helpURL: 'http://www.oracle.com/technetwork/java/javase/downloads/index.html',
    parseVersion: function (stdout, stderr) {
      if (stderr && stderr.split('java version')[1]) {
        var versionInfo = stderr.split('"')[1];
        this.version(versionInfo);
        if (versionCompare(versionInfo, '1.7.0_55') < 0){
            this.statusText(' - Elasticsearch requires at least JDK version 1.7.0_55')
            return false;
        }
        if (versionCompare(versionInfo, '1.8') > 0 &&
            versionCompare(versionInfo, '1.8.0_20') < 0 ){
            this.statusText(' - Elasticsearch requires at least JDK version 1.8.0_20')
            return false;
        }
        return (versionCompare(versionInfo, '1.7.0_55') >= 0);
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

var pathViewModelFactory = function(key) {
    var pathStr = localStorage.getItem(key);
    var viewModel = ko.observable(pathStr ? pathStr : '');
    viewModel.subscribe(function(newValue) {
        localStorage.setItem(key, newValue);
    });
    viewModel.showDialog = function () {
        var dir = dialog.showOpenDialog({ properties: [ 'openDirectory', 'createDirectory' ]});
        if (dir) {
            viewModel(dir[0]);
        }
    };
    return viewModel;
};

vm.envPath = pathViewModelFactory('envPath');
vm.appPath = pathViewModelFactory('appPath');
vm.newAppName = ko.observable('');

var getEnvCommand = function (command) {
    var folder = 'bin';
    var prefix = 'source ';
    if (process.platform === 'win32') {
        folder = 'Scripts';
        prefix = '';
    }
    return prefix + '"' + path.join(vm.envPath(), folder, command) + '"';
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
            return getEnvCommand('activate') + ' && pip install arches';
        }
    })
]);

var esProc;
var startElasticSearch = function () {
    var esStartCommand = path.join(vm.appPath(), vm.newAppName(), vm.newAppName(), 'elasticsearch/elasticsearch-1.4.1/bin/elasticsearch');
    var proc = cp.spawn(esStartCommand, [], {
        detatched: true
    });
    proc.on('error', function (err) {
      console.log(err);
    });
    return proc;
};
var installHip = new CommandRunner([
    new command({
        description: 'Installing arches-hip',
        getCommand: function () {
            return getEnvCommand('activate') + ' && pip install arches_hip';
        }
    }),
    new command({
        description: 'Creating application',
        getCommand: function () {
            return getEnvCommand('activate') + ' && cd "' + vm.appPath() + '" ' +
                '&& arches-app create ' + vm.newAppName() + ' --app arches_hip';
        }
    }),
    new command({
        description: 'Setting up elasticsearch',
        getCommand: function () {
            return getEnvCommand('activate') + ' && cd "' + path.join(vm.appPath(), vm.newAppName()) + '" ' +
                '&& python manage.py packages -o setup_elasticsearch';
        },
        postExec: function (error, stdout, stderr, callback) {
            var cmd = this;
            esProc = startElasticSearch();
            setTimeout(function() {
                cmd.running(false);
                cmd.complete(true);
                cmd.success(!error);
                callback(cmd);
            }, 5000);
        }
    }),
    new command({
        description: 'Creating database',
        getCommand: function () {
            return getEnvCommand('activate') + ' && cd "' + path.join(vm.appPath(), vm.newAppName()) + '" ' +
                '&& python manage.py packages -o install';
        },
        postExec: function (error, stdout, stderr, callback) {
            esProc.kill();
            this.running(false);
            this.complete(true);
            this.success(!error);
            callback(this);
        }
    })
]);

vm.applicationList = [
    new application({
        name: 'Blank Arches',
        caption: 'A "blank slate" to define a custom cultural heritage inventory',
        description: 'Choosing the Blank Application allows you to design your own Arches resources for managing your cultural heritage.  Or you can import existing resource definitions and modify them for your needs.',
        image: 'assets/img/img3.jpg',
        installer: installHip
    }),
    new application({
        name: 'Arches-HIP',
        caption: 'An application for managing immovable cultural heritage',
        description: 'This application models cultural heritage resources as: Historic Resources, Historic Resource Groups, Activities, Events, Actors (People or Groups), and Information Objects.',
        image: 'assets/img/arches-hip.png',
        installer: installHip
    })
];

vm.selectedApplication = ko.observable(vm.applicationList[1]);

vm.devServerRunning = ko.observable(false);
var devServer;
vm.devServerRunning.subscribe(function (running) {
    if (running) {
        var djangoCmd = getEnvCommand('python') + ' ' + path.join(vm.appPath(), vm.newAppName(), 'manage.py') + ' runserver';
        devServer = [
            startElasticSearch(),
            cp.exec(djangoCmd, function() {
                console.log(arguments);
            })
        ];
    } else if (devServer) {
        for (var i = 0; i < devServer.length; i++) {
            devServer[i].kill();
        }
        devServer = null;
    }
});
process.on('exit', function () {
    if (devServer) {
        for (var i = 0; i < devServer.length; i++) {
            devServer[i].kill();
        }
    }
})

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
        tabLink: '#select-tab',
        readyModel: {
            ready: ko.computed(function() {
                return vm.selectedApplication().installer.success()
            })
        }
    }, tabDefaults()))
);
var installTab = new tab(_.extend({
    title: 'Install Application',
    description: 'Install Arches application',
    tabLink: '#install-tab'
}, tabDefaults()));
vm.tabs.push(installTab);
vm.selectedApplication.subscribe(function(newValue) {
    if (newValue) {
        installTab.activateTab();
    }
});
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

$('input[type=checkbox]').each(function(i, checkbox) {
    new Switchery(checkbox, { size: 'small' });
    checkbox.onchange = function() {
      console.log('a');
    };
});
$('.app-name-input').bind('keypress', function(e) {
    if (e.which < 48 ||
        (e.which > 57 && e.which < 65) ||
        (e.which > 90 && e.which < 97 && e.which !==95) ||
        e.which > 122) {
        e.preventDefault();
    }
});

ko.applyBindings(vm);
