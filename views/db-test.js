var $ = require('jquery');
var ko = require('jquery');
$('#test-connection').click(function() {
  var knex = require('knex')({
    client: 'postgresql',
    connection: {
      host: $('#host').val(),
      port: $('#port').val(),
      user: $('#user').val(),
      password: $('#password').val(),
      database: $('#database').val(),
      charset: 'UTF8_GENERAL_CI'
    }
  });

  knex.raw('select * from spatial_ref_sys limit 1').then(function () {
    $('#result').text('yes');
  }).catch(function () {
    $('#result').text('no');
  });
});
