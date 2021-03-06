require('fix-path')();
var $ = require('jquery');
var _ = require('underscore');
var jQuery = $;
require('bootstrap');
var ko = require('knockout');
var shell = require('shell');
var path = require('path');
var dialog = require('electron').remote.dialog;
var Switchery = require('switchery');
var fs = require('fs');
var mustache = require('mustache');
var cp = require('child_process');
var kill = require('tree-kill');
var chosen = require('chosen-npm/public/chosen.jquery.min');
var dependency = require('./models/dependency');
var postgres = require('./models/postgres');
var command = require('./models/command');
var CommandRunner = require('./models/command-runner');
var tab = require('./models/tab');
var application = require('./models/application');
var languages = require('./assets/data/languages.json').languages;
var timezones = require('./assets/data/timezones.json').timezones;

ko.bindingHandlers.chosen = {
  init: function(element) {
    $(element).addClass('chzn-select');
    $(element).chosen();
  },
  update: function(element) {
    $(element).trigger('liszt:updated');
  }
};

var defaults = localStorage.getItem('archesInstallerData') ? JSON.parse(localStorage.getItem('archesInstallerData')) : {
    postgres: {
        host: 'localhost',
        port: '5432',
        user: 'postgres',
        password: 'postgis',
        postgisTemplate: 'template_postgis_20'
    },
    dependenciesChecked: false,
    activeTab: null,
    envPath: '',
    appPath: '',
    mediaPath: '',
    newAppName: '',
    installArchesComplete: false,
    importThesauri: true,
    selectedApplication: 'arches_hip',
    installApplicationComplete: false,
    defaultLanguage: 'en-US',
    timezone: 'America/Chicago'
};
var vm = {
    archesVersion: '3.1.2',
    languages: languages,
    timezones: timezones,
    defaultLanguage: ko.observable(defaults.defaultLanguage),
    timezone: ko.observable(defaults.timezone),
};
vm.showSplash = ko.observable(defaults.activeTab===null);
vm.activeTab = ko.observable(vm.showSplash()?0:defaults.activeTab);
vm.postgres = new postgres(defaults.postgres);
vm.postgres.testConnection();

vm.openExternal = shell.openExternal;

vm.geos = new dependency({
    name: 'GEOS',
    versionCmd: process.platform==='win32' ? 'IF EXIST C:/OSGeo4W' + ((process.arch==='x64')?'64':'') + '/bin/geos_c.dll ECHO True' : 'geos-config --version',
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
            if (this.versionCompare(versionInfo, '2.7.6') < 0){
                this.statusText(' - Arches requires at least python version 2.7.6')
                return false;
            }
            if (this.versionCompare(versionInfo, '2.7.7') === 0 ||
            this.versionCompare(versionInfo, '2.7.8') === 0){
                this.statusText(' - Version 2.7.7 and 2.7.8 might not work as expected')
                return false;
            }
            return (this.versionCompare(versionInfo, '2.7.6') >= 0);
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
            if (this.versionCompare(versionInfo, '1.7.0_50') < 0){
                this.statusText(' - Elasticsearch requires at least JDK version 1.7.0_50')
                return false;
            }
            if (this.versionCompare(versionInfo, '1.8') > 0 &&
            this.versionCompare(versionInfo, '1.8.0_20') < 0 ){
                this.statusText(' - Elasticsearch requires at least JDK version 1.8.0_20')
                return false;
            }
            return (this.versionCompare(versionInfo, '1.7.0_50') >= 0);
        }
        return false;
    }
});

vm.psql = new dependency({
    name: 'psql (PostgreSQL command line client)',
    versionCmd: 'psql --version',
    helpURL: 'http://www.postgresql.org/docs/current/static/app-psql.html',
    parseVersion: function (stdout, stderr) {
        if (stdout) {
            var version = stdout.split(' ')[stdout.split(' ').length-1];
            this.version(version);
            return true;
        }
        this.statusText(' - psql not found, you may need to add it to your PATH')
        return false;
    }
});

vm.dependencies = [vm.python, vm.geos, vm.java, vm.psql];
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
                vm.dependenciesChecked(true);
            }
        };
        check();
    }, 1000);
};
vm.dependenciesChecked = ko.observable(defaults.dependenciesChecked)
if (vm.dependenciesChecked()) {
    vm.checkDependencies();
}

var pathViewModelFactory = function(key) {
    var viewModel = ko.observable(defaults[key]);
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
vm.mediaPath = pathViewModelFactory('mediaPath');
vm.newAppName = ko.observable(defaults.newAppName);

var settingsTemplate = fs.readFileSync(path.join(__dirname, '/templates/settings.py'), 'utf8');
var updateApplicationSettings = function () {
    if (vm.appPath() !== '') {
        var filePath = path.join(vm.appPath(), vm.newAppName(), vm.newAppName(), 'settings_local.py');
        var content = mustache.render(settingsTemplate, {
            windows: (process.platform === 'win32'),
            x64: (process.arch === 'x64'),
            host: vm.postgres.host(),
            port: vm.postgres.port(),
            user: vm.postgres.user(),
            password: vm.postgres.password(),
            postgisTemplate: vm.postgres.postgisTemplate(),
            mediaPath: (vm.mediaPath() == '') ? false : vm.mediaPath(),
            defaultLanguage: vm.defaultLanguage(),
            timezone: vm.timezone()
        });
        fs.writeFile(filePath, content, function(err) {
            if(err) {
                console.log(err);
            }
        });
    }
};

_.each([
    vm.mediaPath,
    vm.defaultLanguage,
    vm.timezone
], function(obs) {
    obs.subscribe(function() {
        updateApplicationSettings();
    });
});

var getEnvCommand = function (command, sourcePrefix) {
    var folder = 'bin';
    var prefix = sourcePrefix?'source ':'';
    if (process.platform === 'win32') {
        folder = 'Scripts';
        prefix = '';
    }
    var fullCommand = path.join(vm.envPath(), folder, command);
    if (process.platform==='win32') {
        fullCommand = '"' + fullCommand + '"';
    }
    return prefix + fullCommand;
};

vm.installArches = new CommandRunner('Arches framework', [
    new command({
        description: 'Installing pip',
        command: 'python "' + path.join(__dirname, 'assets/scripts/get-pip.py') + '"',
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
            return getEnvCommand('activate', true) + ' && pip install arches==' + vm.archesVersion;
        }
    })
]);

if (defaults.installArchesComplete) {
    for (var i = 0; i < vm.installArches.commands.length; i++) {
        vm.installArches.commands[i].complete(true);
        vm.installArches.commands[i].success(true);
    }
    vm.installArches.current(vm.installArches.commands.length);
}

var esProc;
var startElasticSearch = function () {
    var esStartCommand = path.join(vm.appPath(), vm.newAppName(), vm.newAppName(), 'elasticsearch/elasticsearch-1.4.1/bin/elasticsearch');
    if (process.platform==='win32') {
        esStartCommand = '"' + esStartCommand + '"';
    }
    var proc = cp.spawn(esStartCommand);
    proc.on('error', function (err) {
        console.log(err);
    });
    return proc;
};

vm.importThesauri = ko.observable(defaults.importThesauri);

var importThesauriFactory = function (applicationName) {
    var authFilesDir = path.join(vm.envPath(), 'lib/python2.7/site-packages', applicationName, 'source_data/sample_data/concepts/sample_authority_files');
    return new command({
        description: 'Importing default Thesauri',
        getCommand: function () {
            return getEnvCommand('activate', true) + ' && cd "' + path.join(vm.appPath(), vm.newAppName()) + '" ' +
            "&& python manage.py packages -o load_concept_scheme -s '" + authFilesDir + "'";
        }
    });
}
var applicationInstallerFactory = function (applicationName, version, hasDefaultAuthFiles) {
    var commands = [
        new command({
            description: 'Creating application',
            getCommand: function () {
                return getEnvCommand('activate', true) + ' && cd "' + vm.appPath() + '" ' +
                '&& ' + (process.platform==='win32' ? getEnvCommand('python') + ' ' + getEnvCommand('arches-app') : 'arches-app') + ' create ' + vm.newAppName() + ' --app ' + applicationName;
            },
            postExec: function (error, stdout, stderr, callback) {
                updateApplicationSettings();
                this.running(false);
                this.complete(true);
                this.success(!error);
                callback(this);
            }
        }),
        new command({
            description: 'Setting up elasticsearch',
            getCommand: function () {
                return getEnvCommand('activate', true) + ' && cd "' + path.join(vm.appPath(), vm.newAppName()) + '" ' +
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
                return getEnvCommand('activate', true) + ' && cd "' + path.join(vm.appPath(), vm.newAppName()) + '" ' +
                '&& python manage.py packages -o install';
            }
        })
    ];
    if (vm.importThesauri() && hasDefaultAuthFiles) {
        commands.push(importThesauriFactory(applicationName));
    }
    if (applicationName !== 'arches') {
        commands.unshift(new command({
            description: 'Installing ' + applicationName,
            getCommand: function () {
                return getEnvCommand('activate', true) + ' && pip install ' + applicationName + '==' + version;
            }
        }))
    }

    return new CommandRunner(applicationName, commands, function () {
        if (esProc) {
            kill(esProc.pid);
        }
    });
}

vm.applicationList = [
    new application({
        name: 'Blank Arches',
        module: 'arches',
        version: vm.archesVersion,
        hasDefaultAuthFiles: false,
        caption: 'A "blank slate" to define a custom cultural heritage inventory',
        description: 'Choosing the Blank Application allows you to design your own Arches resources for managing your cultural heritage.  Or you can import existing resource definitions and modify them for your needs.',
        image: 'assets/img/img3.jpg',
        installer: applicationInstallerFactory('arches',  vm.archesVersion, false)
    }),
    new application({
        name: 'Arches-HIP',
        module: 'arches_hip',
        version: '1.0.4',
        hasDefaultAuthFiles: true,
        caption: 'An application for managing immovable cultural heritage',
        description: 'This application models cultural heritage resources as: Historic Resources, Historic Resource Groups, Activities, Events, Actors (People or Groups), and Information Objects.',
        image: 'assets/img/arches-hip.png',
        installer: applicationInstallerFactory('arches_hip', '1.0.4', true)
    })
];

var selectedApplicationIndex = 0;
for (var i = 0; i < vm.applicationList.length; i++) {
    if (vm.applicationList[i].module === defaults.selectedApplication) {
        selectedApplicationIndex = i;
    }
}

vm.selectedApplication = ko.observable(vm.applicationList[selectedApplicationIndex]);

ko.computed(function () {
    vm.importThesauri();
    vm.envPath();
    vm.appPath();
    vm.newAppName();
    for (var i = 0; i < vm.applicationList.length; i++) {
        vm.applicationList[i].installer = applicationInstallerFactory(vm.applicationList[i].module, vm.applicationList[i].version, vm.applicationList[i].hasDefaultAuthFiles);
    }
    vm.selectedApplication(vm.selectedApplication());
});

vm.devServerRunning = ko.observable(false);
var devServer;
vm.devServerRunning.subscribe(function (running) {
    if (running) {
        var djangoProc = cp.spawn(getEnvCommand('python'), [path.join(vm.appPath(), vm.newAppName(), 'manage.py'), 'runserver']);
        devServer = [
            startElasticSearch(),
            djangoProc
        ];
    } else if (devServer) {
        var killServer = devServer;
        for (var i = 0; i < killServer.length; i++) {
            kill(killServer[i].pid);
        }
        devServer = null;
    }
});

window.onbeforeunload = function(e) {
    if (devServer) {
        e.returnValue = false;
        var killCount = 0;
        for (var i = 0; i < devServer.length; i++) {
            kill(devServer[i].pid, 'SIGTERM', function () {
                killCount += 1;
                if (killCount === devServer.length) {
                    devServer = null;
                    window.close();
                }
            });
        }
    }
};

vm.tabs = [];
var tabDefaults = function () {
    return {
        index: vm.tabs.length,
        active: (vm.tabs.length===vm.activeTab()),
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
            this.active(true);
            vm.activeTab(this.index);
        }
    }
};
vm.tabs.push(
    new tab(_.extend({
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
vm.installTab = new tab(_.extend({
    title: 'Install Application',
    description: 'Install Arches application',
    tabLink: '#install-tab'
}, tabDefaults()));
vm.tabs.push(vm.installTab);

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

ko.computed(function () {
    var localStorageData = {
        postgres: {
            host: vm.postgres.host(),
            port: vm.postgres.port(),
            user: vm.postgres.user(),
            password: vm.postgres.password(),
            postgisTemplate: vm.postgres.postgisTemplate()
        },
        dependenciesChecked: vm.dependenciesChecked(),
        activeTab: vm.activeTab(),
        envPath: vm.envPath(),
        appPath: vm.appPath(),
        mediaPath: vm.mediaPath(),
        newAppName: vm.newAppName(),
        importThesauri: vm.importThesauri(),
        installArchesComplete: vm.installArches.complete() && vm.installArches.success(),
        selectedApplication: vm.selectedApplication().module,
        installApplicationComplete: vm.selectedApplication().installer.complete() && vm.selectedApplication().installer.success(),
        defaultLanguage: vm.defaultLanguage(),
        timezone: vm.timezone()
    };
    localStorage.setItem('archesInstallerData', JSON.stringify(localStorageData));
});

if (defaults.installApplicationComplete) {
    for (var i = 0; i < vm.selectedApplication().installer.commands.length; i++) {
        vm.selectedApplication().installer.commands[i].complete(true);
        vm.selectedApplication().installer.commands[i].success(true);
    }
    vm.selectedApplication().installer.current(vm.selectedApplication().installer.commands.length);
}

$('.app-name-input').bind('keypress', function(e) {
    if (e.which < 48 || (e.which > 57 && e.which < 65) || (e.which > 90 && e.which < 97 && e.which !==95) || e.which > 122) {
        e.preventDefault();
    }
});

ko.applyBindings(vm);
