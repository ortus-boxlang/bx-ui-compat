/**
 * [BoxLang]
 *
 * Copyright [2023] [Ortus Solutions, Corp]
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
package ortus.boxlang.compat.ui.components;

import static com.google.common.truth.Truth.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;

public class AjaxProxyTest extends BaseIntegrationTest {

	@DisplayName( "It can create a CFC proxy with default class name" )
	@Test
	public void testCFCProxyDefaultClassName() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy cfc="myapp.components.UserService" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<script type=\"text/javascript\">" );
		assertThat( output ).contains( "class UserService" );
		assertThat( output ).contains( "this.cfcPath = 'myapp.components.UserService'" );
		assertThat( output ).contains( "window.UserService = new UserService()" );
		assertThat( output ).contains( "async callMethod(methodName, args = {})" );
		assertThat( output ).contains( "fetch(url, {" );
	}

	@DisplayName( "It can create a CFC proxy with custom class name" )
	@Test
	public void testCFCProxyCustomClassName() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy cfc="services.DataService" jsclassname="MyDataProxy" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "class MyDataProxy" );
		assertThat( output ).contains( "this.cfcPath = 'services.DataService'" );
		assertThat( output ).contains( "window.MyDataProxy = new MyDataProxy()" );
	}

	@DisplayName( "It can execute bind expressions for CFC methods" )
	@Test
	public void testBindExpressionCFC() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="cfc:mycomponent.getData(param1,param2)" onSuccess="handleSuccess" onError="handleError" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<script type=\"text/javascript\">" );
		assertThat( output ).contains( "formData.append('method', 'getData')" );
		assertThat( output ).contains( "formData.append('cfc', 'mycomponent')" );
		assertThat( output ).contains( "formData.append('param1', 'param1')" );
		assertThat( output ).contains( "formData.append('param2', 'param2')" );
		assertThat( output ).contains( "handleSuccess(result)" );
		assertThat( output ).contains( "handleError(error.message" );
	}

	@DisplayName( "It handles bind expressions without parameters" )
	@Test
	public void testBindExpressionNoParams() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="cfc:userservice.getUsers()" onSuccess="displayUsers" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "formData.append('method', 'getUsers')" );
		assertThat( output ).contains( "formData.append('cfc', 'userservice')" );
		assertThat( output ).contains( "displayUsers(result)" );
		// Should not contain parameter appends
		assertThat( output ).doesNotContain( "formData.append('param1'" );
	}

	@DisplayName( "It throws error when both cfc and bind attributes are missing" )
	@Test
	public void testMissingRequiredAttributes() {
		try {
			runtime.executeSource(
			    """
			    bx:ajaxproxy {
			    }
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "Either cfc or bind attribute is required" );
		}
	}

	@DisplayName( "It can handle both cfc and bind attributes together" )
	@Test
	public void testBothCFCAndBind() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy cfc="services.TestService" jsclassname="TestProxy" bind="cfc:services.TestService.initialize()" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// Should contain both the proxy class definition and bind execution
		assertThat( output ).contains( "class TestProxy" );
		assertThat( output ).contains( "formData.append('cfc', 'services.TestService')" );
	}

	@DisplayName( "It handles non-CFC bind expressions gracefully" )
	@Test
	public void testNonCFCBindExpression() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="javascript:myFunction()" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// javascript: has no {tokens} so no event listeners, but _bxEval exists
		assertThat( output ).contains( "_bxEval" );
	}

	@DisplayName( "It generates proper Fetch API calls" )
	@Test
	public void testFetchAPIGeneration() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy cfc="test.Service" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "const response = await fetch(url, {" );
		assertThat( output ).contains( "method: 'POST'" );
		assertThat( output ).contains( "body: formData" );
		assertThat( output ).contains( "'X-Requested-With': 'XMLHttpRequest'" );
		assertThat( output ).contains( "if (!response.ok)" );
		assertThat( output ).contains( "HTTP ' + response.status + ': ' + response.statusText" );
	}

	// -------------------------------------------------------------------------
	// URL bind expression
	// -------------------------------------------------------------------------

	@DisplayName( "It generates event-driven code for url: bind with {element} tokens" )
	@Test
	public void testURLBindWithToken() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="url:target.cfm?param={elementId}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_bxFetch" );
		assertThat( output ).contains( "addEventListener" );
		assertThat( output ).contains( "elementId" );
		assertThat( output ).contains( "target" );
	}

	@DisplayName( "It generates event-driven code for url: bind with form:field tokens" )
	@Test
	public void testURLBindWithFormField() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="url:process.cfm?val={myform:field1}" onSuccess="cb" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_bxFetch" );
		assertThat( output ).contains( "addEventListener" );
		assertThat( output ).contains( "myform" );
		assertThat( output ).contains( "field1" );
		assertThat( output ).contains( "cb(result)" );
	}

	@DisplayName( "It generates event-driven code for url: bind with @event suffix" )
	@Test
	public void testURLBindWithEvent() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="url:do.cfm?t={ctrl.inp@keyup}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "keyup" );
		assertThat( output ).contains( "addEventListener" );
	}

	@DisplayName( "It resolves {element} tokens by name when id is absent (ACF compat)" )
	@Test
	public void testURLBindResolvesByName() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="url:do.cfm?val={myInput}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_bxFindEl" );
		assertThat( output ).contains( "getElementsByName" );
	}

	// -------------------------------------------------------------------------
	// JavaScript bind expression
	// -------------------------------------------------------------------------

	@DisplayName( "It generates event-driven code for javascript: bind with {element} tokens" )
	@Test
	public void testJSBindWithToken() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="javascript:test({input1})" onSuccess="handleResult" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_bxEval" );
		assertThat( output ).contains( "addEventListener" );
		assertThat( output ).contains( "input1" );
		assertThat( output ).contains( "handleResult(result)" );
	}

	@DisplayName( "It generates code for javascript: bind without tokens (no listeners)" )
	@Test
	public void testJSBindWithoutTokens() {
		runtime.executeSource(
		    """
		    bx:ajaxproxy bind="javascript:getDate()" onSuccess="showDate" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_bxEval" );
		assertThat( output ).doesNotContain( "addEventListener" );
		assertThat( output ).contains( "showDate(result)" );
	}
}