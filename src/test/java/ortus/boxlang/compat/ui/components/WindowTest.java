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
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;
import ortus.boxlang.runtime.types.exceptions.BoxRuntimeException;

public class WindowTest extends BaseIntegrationTest {

	// -------------------------------------------------------------------------
	// Required attribute validation
	// -------------------------------------------------------------------------

	@DisplayName( "It throws an error when name attribute is missing" )
	@Test
	public void testMissingNameThrows() {
		assertThrows( BoxRuntimeException.class, () -> runtime.executeSource(
		    """
		    bx:window title="No Name" {}
		    """,
		    context
		) );
	}

	@DisplayName( "It throws an error when name is an empty string" )
	@Test
	public void testEmptyNameThrows() {
		assertThrows( BoxRuntimeException.class, () -> runtime.executeSource(
		    """
		    bx:window name="" title="Empty Name" {}
		    """,
		    context
		) );
	}

	// -------------------------------------------------------------------------
	// Basic HTML structure
	// -------------------------------------------------------------------------

	@DisplayName( "It generates a seed div with the correct id and data attribute" )
	@Test
	public void testSeedDivStructure() {
		runtime.executeSource(
		    """
		    bx:window name="myWin" title="Hello" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "id=\"myWin-body\"" );
		assertThat( output ).contains( "class=\"bx-cfwindow-seed\"" );
		assertThat( output ).contains( "data-window-name=\"myWin\"" );
		assertThat( output ).contains( "style=\"display:none;\"" );
	}

	@DisplayName( "It renders inline body content inside the seed div" )
	@Test
	public void testBodyContent() {
		runtime.executeSource(
		    """
		    bx:window name="bodyWin" {
		        writeOutput("<p>Window body content</p>");
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<p>Window body content</p>" );
	}

	@DisplayName( "It emits a source comment instead of body content when source is set" )
	@Test
	public void testSourceAttributeSkipsBody() {
		runtime.executeSource(
		    """
		    bx:window name="srcWin" source="/pages/content.bxm" {
		        writeOutput("This should not appear");
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx:window source:" );
		assertThat( output ).contains( "/pages/content.bxm" );
		assertThat( output ).doesNotContain( "This should not appear" );
	}

	// -------------------------------------------------------------------------
	// Bootstrap script
	// -------------------------------------------------------------------------

	@DisplayName( "It generates a ColdFusion.Window.create() call" )
	@Test
	public void testScriptCreateCall() {
		runtime.executeSource(
		    """
		    bx:window name="scriptWin" title="MyWindow" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<script type=\"text/javascript\">" );
		assertThat( output ).contains( "ColdFusion.Window.create(" );
		assertThat( output ).contains( "'scriptWin'" );
		// title is JS-encoded; "MyWindow" has no special chars so it appears literally
		assertThat( output ).contains( "'MyWindow'" );
	}

	@DisplayName( "It wraps the init call in a DOMContentLoaded guard" )
	@Test
	public void testDOMReadyGuard() {
		runtime.executeSource(
		    """
		    bx:window name="domWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "document.readyState===" );
		assertThat( output ).contains( "document.addEventListener('DOMContentLoaded'" );
	}

	@DisplayName( "It warns when cfwindow.js module is not loaded" )
	@Test
	public void testMissingModuleWarning() {
		runtime.executeSource(
		    """
		    bx:window name="warnWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "ColdFusion.Window not loaded" );
		assertThat( output ).contains( "bx:ajaximport" );
	}

	// -------------------------------------------------------------------------
	// Config attributes serialised into JS
	// -------------------------------------------------------------------------

	@DisplayName( "It serialises width and height into the config object" )
	@Test
	public void testWidthHeightInConfig() {
		runtime.executeSource(
		    """
		    bx:window name="sizeWin" width="800" height="600" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "width: 800" );
		assertThat( output ).contains( "height: 600" );
	}

	@DisplayName( "It serialises minWidth and minHeight when provided" )
	@Test
	public void testMinDimensionsInConfig() {
		runtime.executeSource(
		    """
		    bx:window name="minWin" minWidth="200" minHeight="150" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "minwidth: 200" );
		assertThat( output ).contains( "minheight: 150" );
	}

	@DisplayName( "It serialises x and y coordinates when provided" )
	@Test
	public void testXYCoordinatesInConfig() {
		runtime.executeSource(
		    """
		    bx:window name="xyWin" x="100" y="200" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "x: 100" );
		assertThat( output ).contains( "y: 200" );
	}

	@DisplayName( "It sets center=true in the config" )
	@Test
	public void testCenterAttribute() {
		runtime.executeSource(
		    """
		    bx:window name="centerWin" center="true" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "center: true" );
	}

	@DisplayName( "It sets initshow=true when initShow is true" )
	@Test
	public void testInitShowTrue() {
		runtime.executeSource(
		    """
		    bx:window name="showWin" initShow="true" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "initshow: true" );
	}

	@DisplayName( "It sets initshow=false by default" )
	@Test
	public void testInitShowDefaultFalse() {
		runtime.executeSource(
		    """
		    bx:window name="hiddenWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "initshow: false" );
	}

	@DisplayName( "It serialises modal=true into the config" )
	@Test
	public void testModalAttribute() {
		runtime.executeSource(
		    """
		    bx:window name="modalWin" modal="true" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "modal: true" );
	}

	@DisplayName( "It serialises closable=false into the config" )
	@Test
	public void testClosableFalse() {
		runtime.executeSource(
		    """
		    bx:window name="noCloseWin" closable="false" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "closable: false" );
	}

	@DisplayName( "It serialises draggable=false into the config" )
	@Test
	public void testDraggableFalse() {
		runtime.executeSource(
		    """
		    bx:window name="noDragWin" draggable="false" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "draggable: false" );
	}

	@DisplayName( "It serialises resizable=false into the config" )
	@Test
	public void testResizableFalse() {
		runtime.executeSource(
		    """
		    bx:window name="noResizeWin" resizable="false" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "resizable: false" );
	}

	@DisplayName( "It serialises destroyOnClose=true into the config" )
	@Test
	public void testDestroyOnClose() {
		runtime.executeSource(
		    """
		    bx:window name="destroyWin" destroyOnClose="true" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "destroyonclose: true" );
	}

	@DisplayName( "It serialises refreshOnShow=true into the config" )
	@Test
	public void testRefreshOnShow() {
		runtime.executeSource(
		    """
		    bx:window name="refreshWin" source="/pages/live.bxm" refreshOnShow="true" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "refreshonshow: true" );
	}

	@DisplayName( "It passes the source URL as the third argument to Window.create" )
	@Test
	public void testSourcePassedToCreate() {
		runtime.executeSource(
		    """
		    bx:window name="urlWin" source="/pages/body.bxm" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// encodeForJavaScript encodes '/' as \x2F
		assertThat( output ).contains( "'\\x2Fpages\\x2Fbody.bxm'" );
	}

	@DisplayName( "It passes null as the source argument when no source is given" )
	@Test
	public void testNullSourceWhenOmitted() {
		runtime.executeSource(
		    """
		    bx:window name="noSrcWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// third arg to create() must be null when source is omitted
		assertThat( output ).contains( ", null," );
	}

	@DisplayName( "It serialises headerStyle into the config" )
	@Test
	public void testHeaderStyle() {
		runtime.executeSource(
		    """
		    bx:window name="styledWin" headerStyle="background-color: ##336699; color: white;" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "headerstyle:" );
		// encodeForJavaScript encodes '-' as \x2D, ':' as \x3A, space as \x20
		assertThat( output ).contains( "background\\x2Dcolor" );
	}

	@DisplayName( "It serialises bodyStyle into the config" )
	@Test
	public void testBodyStyle() {
		runtime.executeSource(
		    """
		    bx:window name="bodyStyleWin" bodyStyle="padding: 10px; font-size: 14px;" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bodystyle:" );
		assertThat( output ).contains( "padding" );
	}

	@DisplayName( "It serialises onBindError into the config" )
	@Test
	public void testOnBindError() {
		runtime.executeSource(
		    """
		    bx:window name="errorWin" source="/data.bxm" onBindError="handleBindError" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "onBindError:" );
		assertThat( output ).contains( "handleBindError" );
	}

	@DisplayName( "It auto-generates an id when not provided" )
	@Test
	public void testAutoGeneratedId() {
		runtime.executeSource(
		    """
		    bx:window name="autoIdWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "divid: 'window_" );
	}

	@DisplayName( "It uses a provided id in the config" )
	@Test
	public void testExplicitId() {
		runtime.executeSource(
		    """
		    bx:window name="explicitIdWin" id="my-custom-dialog" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// encodeForJavaScript encodes '-' as \x2D
		assertThat( output ).contains( "divid: 'my\\x2Dcustom\\x2Ddialog'" );
	}

	@DisplayName( "It sets callfromtag=true in the config" )
	@Test
	public void testCallFromTagFlag() {
		runtime.executeSource(
		    """
		    bx:window name="tagWin" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "callfromtag: true" );
	}

	@DisplayName( "It throws an error for a non-numeric width" )
	@Test
	public void testInvalidWidthThrows() {
		assertThrows( BoxRuntimeException.class, () -> runtime.executeSource(
		    """
		    bx:window name="badWin" width="notanumber" {}
		    """,
		    context
		) );
	}

	@DisplayName( "It throws an error for a non-numeric height" )
	@Test
	public void testInvalidHeightThrows() {
		assertThrows( BoxRuntimeException.class, () -> runtime.executeSource(
		    """
		    bx:window name="badWin" height="notanumber" {}
		    """,
		    context
		) );
	}

	// -------------------------------------------------------------------------
	// Bind expression in source URL
	// -------------------------------------------------------------------------

	@DisplayName( "It preserves bind expressions in the source URL" )
	@Test
	public void testSourceWithBindExpression() {
		runtime.executeSource(
		    """
		    bx:window name="bindWin" source="test-window.cfm?test={myform:test}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// The bind expression {myform:test} should be preserved via \x7B/\x7D encoding
		assertThat( output ).contains( "test\\x2Dwindow.cfm?test=" );
		assertThat( output ).contains( "myform" );
		assertThat( output ).contains( "test" );
	}

	@DisplayName( "It preserves bind expression with event suffix in source URL" )
	@Test
	public void testSourceWithBindExpressionAndEvent() {
		runtime.executeSource(
		    """
		    bx:window name="bindEventWin" source="test-window.cfm?text={myform:text1@mousedown}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "text1" );
		assertThat( output ).contains( "mousedown" );
	}

	@DisplayName( "It preserves bind expression with attribute in source URL" )
	@Test
	public void testSourceWithBindExpressionAndAttribute() {
		runtime.executeSource(
		    """
		    bx:window name="bindAttrWin" source="test-window.cfm?val={myform:check1.checked@click}" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "check1" );
		assertThat( output ).contains( ".checked" );
		assertThat( output ).contains( "@click" );
	}

	@DisplayName( "It passes bind error handler name to config" )
	@Test
	public void testOnBindErrorHandlerName() {
		runtime.executeSource(
		    """
		    bx:window name="errWin" source="test.cfm" onBindError="myErrorHandler" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "onBindError:" );
		assertThat( output ).contains( "myErrorHandler" );
	}
}
