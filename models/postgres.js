var Backbone = require('backbone');
var ko = require('knockout');
var knex = require('knex');

module.exports = Backbone.Model.extend({
  constructor: function() {
    var self = this;
    this.user = ko.observable('postgres');
  	this.password = ko.observable('postgis');
  	this.host = ko.observable('localhost');
  	this.port = ko.observable('5432');
  	this.postgisTemplate = ko.observable('template_postgis_20');
    this.ready = ko.observable(false);
    Backbone.Model.apply(this, arguments);

    ko.computed(function() {
    	self.host();
    	self.port();
    	self.user();
    	self.password();
    	self.postgisTemplate();
    	self.testConnection();
    });
  },
  parse: function(data, options) {
    this.user(data.user);
    this.password(data.password);
    this.host(data.host);
    this.port(data.port);
    this.postgisTemplate(data.postgisTemplate);
    this.ready(false);
    this.testConnection();
    return data;
  },
  testConnection: function() {
    var self = this;
    var db = knex({
      client: 'postgresql',
      connection: {
        host: this.host(),
        port: this.port(),
        user: this.user(),
        password: this.password(),
        database: this.postgisTemplate(),
        charset: 'UTF8_GENERAL_CI'
      }
    });

    db.raw('select * from spatial_ref_sys limit 1').then(function () {
      self.ready(true);
		  self.trigger('success');
    }).catch(function () {
      self.ready(false);
      self.trigger('fail');
    });
  }
});
