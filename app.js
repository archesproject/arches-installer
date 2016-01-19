var $ = require('jquery');
var jQuery = $;
var ko = require('knockout');
var shell = require('shell');
require('pace');
require('bootstrap');
require('fastclick');
require('switchery');
require('bootstrap-select');
require('./plugins/bootstrap-wizard/jquery.bootstrap.wizard.min')
require('chosen');
var dependency = require('./models/dependency')
var postgres = require('./models/postgres')

var vm = {};
vm.showSplash = ko.observable(true);
vm.postgres = new postgres();
vm.postgres.testConnection();

vm.openExternal = shell.openExternal;
vm.currentStep = ko.observable(0);
vm.geos = new dependency({
	versionCmd: 'geos-config --version',
	parseVersion: function (versionString) {
		return versionString.split('.')[0]==='3'
	}
});

vm.python = new dependency({
	versionCmd: 'python --version',
	// python incorrectly sends version string to stderr...
	parseVersion: function (stdout, versionString) {
		var versionInfo = versionString.split('Python ')[1].split('.');
		return (versionInfo[0]==='2' && versionInfo[1]==='7');
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
