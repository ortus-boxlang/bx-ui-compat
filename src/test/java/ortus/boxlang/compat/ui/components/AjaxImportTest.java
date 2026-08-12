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

public class AjaxImportTest extends BaseIntegrationTest {

	@DisplayName( "It can import default AJAX resources" )
	@Test
	public void testDefaultImport() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );

		// Check CSS imports
		assertThat( output )
		    .contains( "<link rel=\"stylesheet\" type=\"text/css\" href=\"/bxmodules/bxUICompat/public/index.bxm?target=css/ajax-core.css\"" );
		assertThat( output ).contains( "layout.css" );
		assertThat( output ).contains( "div.css" );
		assertThat( output ).contains( "grid.css" );
		assertThat( output ).contains( "tooltip.css" );
		assertThat( output ).contains( "pod.css" );

		// Check JavaScript imports
		assertThat( output )
		    .contains( "<script type=\"text/javascript\" src=\"/bxmodules/bxUICompat/public/index.bxm?target=js/ajax-core.js\"></script>" );
		assertThat( output ).contains( "layout.js" );
		assertThat( output ).contains( "div.js" );
		assertThat( output ).contains( "grid.js" );
		assertThat( output ).contains( "tooltip.js" );
		assertThat( output ).contains( "pod.js" );
		assertThat( output ).contains( "ajaxproxy.js" );
	}

	@DisplayName( "It can import specific tags" )
	@Test
	public void testSpecificTagsImport() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="layout,grid" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );

		// Should contain core files
		assertThat( output ).contains( "ajax-core.css" );
		assertThat( output ).contains( "ajax-core.js" );

		// Should contain specific tag files
		assertThat( output ).contains( "layout.css" );
		assertThat( output ).contains( "grid.css" );
		assertThat( output ).contains( "layout.js" );
		assertThat( output ).contains( "grid.js" );

		// Should not contain other tag files
		assertThat( output ).doesNotContain( "div.css" );
		assertThat( output ).doesNotContain( "tooltip.css" );
	}

	@DisplayName( "It can use custom CSS and script sources" )
	@Test
	public void testCustomSources() {
		runtime.executeSource(
		    """
		    bx:ajaximport cssSrc="/custom/styles" scriptSrc="/custom/scripts" tags="layout" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "href=\"/custom/styles/ajax-core.css\"" );
		assertThat( output ).contains( "href=\"/custom/styles/layout.css\"" );
		assertThat( output ).contains( "src=\"/custom/scripts/ajax-core.js\"" );
		assertThat( output ).contains( "src=\"/custom/scripts/layout.js\"" );
	}

	@DisplayName( "It initializes BoxLang AJAX namespace" )
	@Test
	public void testBoxLangAjaxInitialization() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "window.BoxLangAjax = window.BoxLangAjax ||" );
		assertThat( output ).contains( "version: '1.0.0'" );
		assertThat( output ).contains( "cssSrc: '/bxmodules/bxUICompat/public/index.bxm?target=css'" );
		assertThat( output ).contains( "scriptSrc: '/bxmodules/bxUICompat/public/index.bxm?target=js'" );
		assertThat( output ).contains( "utils: {}" );
	}

	@DisplayName( "It creates Fetch API utility functions" )
	@Test
	public void testFetchUtilities() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "BoxLangAjax.utils.fetchContent = async function" );
		assertThat( output ).contains( "BoxLangAjax.utils.loadIntoContainer = function" );
		assertThat( output ).contains( "BoxLangAjax.utils.handleAjaxLink = function" );
		assertThat( output ).contains( "'X-Requested-With': 'XMLHttpRequest'" );
		assertThat( output ).contains( "const response = await fetch(url, fetchOptions)" );
	}

	@DisplayName( "It handles container management" )
	@Test
	public void testContainerManagement() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "const container = document.getElementById(containerId)" );
		assertThat( output ).contains( "container.innerHTML = '<div class=\"bx-loading\">Loading...</div>'" );
		assertThat( output ).contains( "container.innerHTML = content" );
		assertThat( output ).contains( "boxlang-content-loaded" );
		assertThat( output ).contains( "'<div class=\"bx-error\">Error loading content: '" );
	}

	@DisplayName( "It handles AJAX link functionality" )
	@Test
	public void testAjaxLinkHandling() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "handleAjaxLink = function(url, event)" );
		assertThat( output ).contains( "event.preventDefault()" );
		assertThat( output ).contains( "currentElement.classList.contains('bx-layout')" );
		assertThat( output ).contains( "currentElement.classList.contains('bx-div')" );
		assertThat( output ).contains( "currentElement.classList.contains('bx-pod')" );
		assertThat( output ).contains( "document.querySelector('.bx-layout, .bx-div, .bx-pod, [id]')" );
	}

	@DisplayName( "It configures parameters correctly" )
	@Test
	public void testParameterConfiguration() {
		runtime.executeSource(
		    """
		    bx:ajaximport params="googlemapkey=ABC123,apikey=XYZ789" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "BoxLangAjax.config.params = {}" );
		assertThat( output ).contains( "BoxLangAjax.config.params['googlemapkey'] = 'ABC123'" );
		assertThat( output ).contains( "BoxLangAjax.config.params['apikey'] = 'XYZ789'" );
	}

	@DisplayName( "It handles DOM ready initialization" )
	@Test
	public void testDOMReadyInitialization() {
		runtime.executeSource(
		    """
		    bx:ajaximport {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "if (document.readyState === 'loading')" );
		assertThat( output ).contains( "document.addEventListener('DOMContentLoaded'" );
		assertThat( output ).contains( "console.log('BoxLang AJAX initialized')" );
	}

	@DisplayName( "It handles empty tags parameter" )
	@Test
	public void testEmptyTagsParameter() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// Should fall back to default behavior and import common tags
		assertThat( output ).contains( "layout.css" );
		assertThat( output ).contains( "div.css" );
		assertThat( output ).contains( "grid.css" );
	}

	@DisplayName( "It can handle a cf prefix correctly" )
	@Test
	public void testCfPrefixHandling() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="cfLayout-tags" {
		    }
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// Should fall back to default behavior and import common tags
		assertThat( output ).contains( "layout.css" );
		assertThat( output ).contains( "layout-components.css" );
	}

	@DisplayName( "It imports window.js when tags includes window" )
	@Test
	public void testWindowTagImportsScript() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="window" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "ajax-core.js" );
		assertThat( output ).contains( "window.js" );
	}

	@DisplayName( "It imports window.js in the default all-tags import" )
	@Test
	public void testWindowJsIncludedInDefault() {
		runtime.executeSource(
		    """
		    bx:ajaximport {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "window.js" );
	}

	@DisplayName( "It does not import window.js when tags excludes it" )
	@Test
	public void testWindowJsNotIncludedWhenExcluded() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="layout,grid" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).doesNotContain( "window.js" );
	}

	@DisplayName( "It imports window.js with a cfwindow tag alias" )
	@Test
	public void testCfWindowTagAlias() {
		runtime.executeSource(
		    """
		    bx:ajaximport tags="cfwindow" {}
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "window.js" );
	}
}