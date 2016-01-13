var $ = require('jquery');
var jQuery = $;
var ko = require('knockout');
var shell = require('shell');
require('pace');
require('bootstrap');
require('fastclick');
require('nifty');
require('switchery');
require('bootstrap-select');
require('./plugins/bootstrap-wizard/jquery.bootstrap.wizard.min')
require('chosen');
var postgres = require('./models/postgres')

var vm = {};
vm.showSplash = ko.observable(true);
vm.postgres = new postgres();
vm.openExternal = shell.openExternal;
vm.currentStep = ko.observable(0);

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

vm.enableNext = ko.computed(function () {
	var enabled = true;
	var step = vm.currentStep();
	switch (step) {
		case 0:
			enabled = vm.postgres.ready();
			break;
	}
	return enabled;
});

vm.postgres.testConnection();

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
