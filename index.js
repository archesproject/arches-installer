var $ = require('jquery');
var jQuery = $;
var ko = require('knockout');
var shell = require('shell');
var vm = {
	postgres: {
		user: ko.observable('postgres'),
		password: ko.observable('postgis'),
		host: ko.observable('localhost'),
		port: ko.observable('5432'),
		postgisTemplate: ko.observable('template_postgis_20')
	}
};
var testDbConnection = function() {
  var knex = require('knex')({
    client: 'postgresql',
    connection: {
      host: vm.postgres.host(),
      port: vm.postgres.port(),
      user: vm.postgres.user(),
      password: vm.postgres.password(),
      database: vm.postgres.postgisTemplate(),
      charset: 'UTF8_GENERAL_CI'
    }
  });

  knex.raw('select * from spatial_ref_sys limit 1').then(function () {
		$('#db-tab .alert.bg-danger').hide();
		$('#db-tab .alert.bg-success').show();
		$('#depend-next').prop('disabled', false);
  }).catch(function () {
		$('#db-tab .alert.bg-success').hide();
    $('#db-tab .alert.bg-danger').show();
		$('#depend-next').prop('disabled', true);
  });
}
ko.computed(function() {
	vm.postgres.host();
	vm.postgres.port();
	vm.postgres.user();
	vm.postgres.password();
	vm.postgres.postgisTemplate();
	testDbConnection();
});
testDbConnection();
require('pace');
require('bootstrap');
require('fastclick');
require('nifty');
require('switchery');
require('bootstrap-select');
require('./plugins/bootstrap-wizard/jquery.bootstrap.wizard.min')
require('chosen');

$("#install-welcome").click(function(){
	$('#splash-container').hide();
	$('#wizard-container').show();
});

$('#dependencies').bootstrapWizard({
	tabClass		: 'wz-steps',
	nextSelector	: '.next',
	previousSelector	: '.previous',
	onTabClick: function(tab, navigation, index) {
		return false;
	},
	onInit : function(){
		$('#demo-main-wz').find('.finish').hide().prop('disabled', true);
	},
	onTabShow: function(tab, navigation, index) {
		var $total = navigation.find('li').length;
		var $current = index+1;
		var $percent = ($current/$total) * 100;
		var wdt = 100/$total;
		var lft = wdt*index;

		$('#dependencies').find('.progress-bar').css({
				'width': wdt+'%',
				'left': lft+"%",
				'position': 'relative',
				'transition': 'all .5s'
			});

		if($current >= $total) {
			$('#dependencies').find('.next').hide();
			$('#dependencies').find('.finish').show();
			$('#dependencies').find('.finish').prop('disabled', false);
		} else {
			$('#dependencies').find('.next').show();
			$('#dependencies').find('.finish').hide().prop('disabled', true);
		}
	}
});

var base_panel_id = '#depend-tab-';
var base_icon_id = '#depend-icon-';
var step = 0;

$("#depend-next").click(function(){
	$(base_panel_id + (step + 1)).css('display', 'block');
	$(base_panel_id + (step + 1)).css('opacity', 1.0);
	$(base_icon_id + (step + 1)).addClass('bg-dark');

	$(base_panel_id + step).css('display', 'none');
	$(base_panel_id + step).css('opacity', 0.0);
	$(base_icon_id + step).addClass('bg-gray-dark');
	$(base_icon_id + step).removeClass('bg-dark');

	step = step + 1;
});

$("#depend-prev").click(function(){
	if (step !== 0 ) {
		$(base_panel_id + step).css('display', 'none');
		$(base_panel_id + step).css('opacity', 0.0);

		$(base_panel_id + (step - 1)).css('display', 'block');
		$(base_panel_id + (step - 1)).css('opacity', 1.0);
		$(base_icon_id + (step - 1)).addClass('bg-dark');

		step = step - 1;
	}
});

$("#help-db-button").click(function(){
	$("#help-db-panel").css('display', 'block');
	$("#help-db-panel").css('opacity', 1.0);
	$("#help-db-panel").css('-webkit-transition', 'opacity .5s linear');
});

$('#postgis-info-link').click(function () {
	shell.openExternal('http://postgis.net/');
});

ko.applyBindings(vm);
