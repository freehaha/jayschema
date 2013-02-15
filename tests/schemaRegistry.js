// Unit tests. Run with mocha.

/*global describe:true it:true */


var should = require('should')
  , SchemaRegistry = require('../lib/schemaRegistry.js')
  , core = require('../lib/suites/draft-04/core.js')
  , uri = require('../lib/uri.js')
  ;

describe('SchemaRegistry:', function() {

  describe('register basic schema:', function() {

    var reg = new SchemaRegistry();
    var sch = {
      id: 'http://foo.bar/baz',
      type: 'integer'
    };

    it('should register schema', function() {
      reg.register(sch).should.be.empty;
      var result = reg.get(sch.id);
      core.jsonEqual(result, sch).should.be.true;
    });

    it('should retrieve schema differing only by empty fragment', function() {
      reg.register(sch).should.be.empty;
      var result = reg.get(sch.id + '#');
      core.jsonEqual(result, sch).should.be.true;
    });

  });

  describe('register schema with external reference:', function() {

    var reg = new SchemaRegistry();
    var sch = {
      id: 'http://foo.bar/baz',
      oneOf: [
        { $ref: 'http://this.is.missing/qux#' }
      ]
    };

    it('should register schema', function() {
      reg.register(sch).should.eql(['http://this.is.missing/qux']);
      var result = reg.get(sch.id);
      core.jsonEqual(result, sch).should.be.true;
    });

    it('second register call for the same should return same missing list',
    function()
    {
      reg.register(sch).should.eql(['http://this.is.missing/qux']);
      reg.register(sch).should.eql(['http://this.is.missing/qux']);
    });
  });

  describe('schema with /definitions section:', function() {

    var reg = new SchemaRegistry();
    var sch = {
      id: 'http://foo.bar/baz',
      oneOf: [
        { $ref: '#/definitions/foo' }
      ],
      definitions: {
        foo: { type: 'integer' },
        bar: { id: '#bar', type: 'string' }
      }
    };

    it('should register schema and sub-schemas', function() {
      reg.register(sch).should.be.empty;
      reg.get(sch.id + '#/definitions/foo').should.eql({type: 'integer'});
      reg.get(sch.id + '#bar').should.eql({id: '#bar', type: 'string'});
      reg.get(sch.id + '#/definitions/bar').should.eql({id: '#bar',
        type: 'string'});
    });
  });

  describe('multiple missing schemas:', function() {

    var reg = new SchemaRegistry();
    var sch1 = {
      id: 'http://foo.bar/baz',
      oneOf: [
        { $ref: 'http://company.com/foo/' }
      ],
      definitions: {
        foo: { type: 'integer' },
        bar: { id: '#bar', type: 'string' },
        qux: { $ref: 'http://organization.org/bar/' }
      }
    };
    var sch2 = {
      oneOf: [
        { $ref: 'http://organization.org/bar/' },
        { $ref: 'http://foo.bar/qux' },
        { $ref: 'http://some.site/and/some/schema#' }
      ]
    };

    it('should be able to return merged missing schemas', function() {
      reg.register(sch1).should.have.length(2);
      reg.register(sch2).should.have.length(3);
      reg.getMissingSchemas().should.have.length(4);
    });
  });

  describe('resolve fragments:', function() {
    var schema = {
        "id": "http://x.y.z/rootschema.json#",
        "schema1": {
            "id": "#foo"
        },
        "schema2": {
            "id": "otherschema.json",
            "nested": {
                "id": "#bar"
            },
            "alsonested": {
                "id": "t/inner.json#a"
            }
        },
        "schema3": {
            "id": "some://where.else/completely#"
        }
    }

    var reg = new SchemaRegistry();
    reg.register(schema);

    var url = require('url');

    it('should resolve fragment-identified schemas', function()
    {
      var scope, fragment, result;
      scope = 'http://x.y.z/rootschema.json#';

      fragment = '#';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema);

      fragment = '#/schema1';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema1);

      fragment = '#foo';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema1);

      fragment = '#/schema2';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2);

      fragment = '#/schema2/nested';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2.nested);

      fragment = '#/schema2/alsonested';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2.alsonested);

      fragment = '#/schema3';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema3);

      scope = 'http://x.y.z/otherschema.json';
      fragment = '#';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2);

      fragment = '#bar';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2.nested);

      scope = 'http://x.y.z/t/inner.json';
      fragment = '#a';
      result = reg.get(uri.resolve(scope, fragment));
      result.should.eql(schema.schema2.alsonested);
    });
  });

});