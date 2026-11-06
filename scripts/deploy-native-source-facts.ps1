# Static syntax only. Never invoke, compile, dot-source or evaluate scanned code.
# Decoded facts travel only over a captured pipe; callers must never log stdout.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$literals=[Collections.Generic.HashSet[string]]::new()
$assignments=[Collections.Generic.List[object]]::new()
$failures=[Collections.Generic.HashSet[string]]::new()
$script:nodeCount=0
function Add-Literal($value) {
  if($null -ne $value -and $value -isnot [bool]) {
    $s=[Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)
    if($s.Length -gt 1048576 -or $literals.Count -ge 20000){throw 'NATIVE_FACT_LIMIT'}
    [void]$literals.Add($s)
  }
}
function CS-Constant($node,[int]$depth=0) {
  if($null -eq $node){return $null}
  if($depth -gt 40){[void]$failures.Add('NATIVE_CONSTANT_DEPTH_LIMIT');return $null}
  switch($node.GetType().Name) {
    'LiteralExpressionSyntax' {if($null -ne $node.Token.Value -and $node.Token.Value -isnot [bool]){return [Convert]::ToString($node.Token.Value,[Globalization.CultureInfo]::InvariantCulture)};return $null}
    'ParenthesizedExpressionSyntax' {return CS-Constant $node.Expression ($depth+1)}
    'BinaryExpressionSyntax' {
      if([string]$node.OperatorToken.Text -eq '+') {
        $a=CS-Constant $node.Left ($depth+1);$b=CS-Constant $node.Right ($depth+1)
        if($null -ne $a -and $null -ne $b){return $a+$b}
      };return $null
    }
    'InterpolatedStringExpressionSyntax' {
      $parts=[Collections.Generic.List[string]]::new()
      foreach($part in $node.Contents){
        if($part.GetType().Name -eq 'InterpolatedStringTextSyntax'){$parts.Add($part.TextToken.ValueText)}
        else {
          $value=CS-Constant $part.Expression ($depth+1)
          if($null -eq $value -or $part.AlignmentClause -or $part.FormatClause){[void]$failures.Add('CSHARP_INTERPOLATION_REVIEW_REQUIRED');return $null}
          $parts.Add($value)
        }
      };return [string]::Join('',$parts)
    }
  }
  return $null
}
function CS-Name($node) {
  if($null -eq $node){return ''}
  switch($node.GetType().Name){
    'IdentifierNameSyntax' {return $node.Identifier.ValueText}
    'MemberAccessExpressionSyntax' {return $node.Name.Identifier.ValueText}
    'ElementAccessExpressionSyntax' {if($node.ArgumentList.Arguments.Count -eq 1){return CS-Constant $node.ArgumentList.Arguments[0].Expression}}
  };return ''
}
function CS-DesignationNames($node,[int]$depth=0) {
  if($null -eq $node){[void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED');return}
  if($depth -gt 40){[void]$failures.Add('NATIVE_NAME_DEPTH_LIMIT');return}
  switch($node.GetType().Name){
    'SingleVariableDesignationSyntax' {return $node.Identifier.ValueText}
    'DiscardDesignationSyntax' {return}
    'ParenthesizedVariableDesignationSyntax' {
      foreach($variable in $node.Variables){CS-DesignationNames $variable ($depth+1)};return
    }
  }
  [void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED')
}
function CS-AssignmentNames($node,[int]$depth=0) {
  if($null -eq $node){[void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED');return}
  if($depth -gt 40){[void]$failures.Add('NATIVE_NAME_DEPTH_LIMIT');return}
  switch($node.GetType().Name){
    'TupleExpressionSyntax' {
      foreach($argument in $node.Arguments){CS-AssignmentNames $argument.Expression ($depth+1)};return
    }
    'DeclarationExpressionSyntax' {CS-DesignationNames $node.Designation ($depth+1);return}
    'ParenthesizedExpressionSyntax' {CS-AssignmentNames $node.Expression ($depth+1);return}
    'ImplicitElementAccessSyntax' {
      if($node.ArgumentList.Arguments.Count -eq 1){
        $key=CS-Constant $node.ArgumentList.Arguments[0].Expression
        if($null -ne $key){return $key}
      }
      [void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED');return
    }
    # Preserve existing treatment of ordinary explicit computed indexes. This
    # does not perform type/data-flow inference for nonconstant array/dict keys.
    'ElementAccessExpressionSyntax' {return CS-Name $node}
  }
  $key=CS-Name $node
  if($key){return $key}
  [void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED')
}
function Add-CSAssignment([string]$key,$expression) {
  if(!$key -or $null -eq $expression){return}
  $values=[Collections.Generic.HashSet[string]]::new()
  foreach($n in @($expression)+@($expression.DescendantNodes())){
    $v=CS-Constant $n
    if($null -ne $v -and $v.Length){[void]$values.Add($v)}
  }
  if($values.Count){$assignments.Add(@{key=$key;values=@($values)})}
}
function Inspect-CS([string]$source,[int]$depth=0) {
  if($depth -gt 3){throw 'NATIVE_NESTING_LIMIT'}
  $tree=[Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText($source)
  if(@($tree.GetDiagnostics() | Where-Object {$_.Severity -eq 'Error'}).Count){[void]$failures.Add('CSHARP_PARSE_FAILED');return}
  $root=$tree.GetRoot()
  foreach($trivia in $root.DescendantTrivia()){
    if($trivia.RawKind -eq [int][Microsoft.CodeAnalysis.CSharp.SyntaxKind]::DisabledTextTrivia){[void]$failures.Add('CSHARP_DISABLED_TEXT_REVIEW_REQUIRED')}
  }
  foreach($node in $root.DescendantNodes()){
    if(++$script:nodeCount -gt 100000){throw 'NATIVE_NODE_LIMIT'}
    Add-Literal (CS-Constant $node)
    switch($node.GetType().Name){
      'VariableDeclaratorSyntax' {if($node.Initializer){Add-CSAssignment $node.Identifier.ValueText $node.Initializer.Value}}
      'PropertyDeclarationSyntax' {
        if($node.Initializer){Add-CSAssignment $node.Identifier.ValueText $node.Initializer.Value}
        if($node.ExpressionBody){Add-CSAssignment $node.Identifier.ValueText $node.ExpressionBody.Expression}
        if($node.AccessorList){foreach($accessor in $node.AccessorList.Accessors){
          if($accessor.Keyword.ValueText -eq 'get'){
            if($accessor.ExpressionBody){Add-CSAssignment $node.Identifier.ValueText $accessor.ExpressionBody.Expression}
            if($accessor.Body){Add-CSAssignment $node.Identifier.ValueText $accessor.Body}
          }
        }}
      }
      'ParameterSyntax' {if($node.Default){Add-CSAssignment $node.Identifier.ValueText $node.Default.Value}}
      'AssignmentExpressionSyntax' {foreach($key in @(CS-AssignmentNames $node.Left)){Add-CSAssignment $key $node.Right}}
      'ForEachVariableStatementSyntax' {foreach($key in @(CS-AssignmentNames $node.Variable)){Add-CSAssignment $key $node.Expression}}
      'ForEachStatementSyntax' {Add-CSAssignment $node.Identifier.ValueText $node.Expression}
      'InitializerExpressionSyntax' {
        # The equivalent Dictionary { { key, value } } initializer must not
        # become an immediate alternative to the implicit [key] assignment.
        if($node.RawKind -eq [int][Microsoft.CodeAnalysis.CSharp.SyntaxKind]::ComplexElementInitializerExpression){
          if($node.Expressions.Count -lt 2){[void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED')}
          else{
            $key=CS-Constant $node.Expressions[0]
            if($null -eq $key){[void]$failures.Add('CSHARP_ASSIGNMENT_TARGET_REVIEW_REQUIRED')}
            else{for($i=1;$i -lt $node.Expressions.Count;$i++){Add-CSAssignment $key $node.Expressions[$i]}}
          }
        }
      }
      'AnonymousObjectMemberDeclaratorSyntax' {if($node.NameEquals){Add-CSAssignment $node.NameEquals.Name.Identifier.ValueText $node.Expression}}
      'ArgumentSyntax' {if($node.NameColon){Add-CSAssignment $node.NameColon.Name.Identifier.ValueText $node.Expression}}
      'InvocationExpressionSyntax' {
        $method=CS-Name $node.Expression
        if($method -in @('FromBase64String','GetString','FromHexString') -and $node.ArgumentList.Arguments.Count){
          if($null -ne (CS-Constant $node.ArgumentList.Arguments[0].Expression)){[void]$failures.Add('NATIVE_ENCODED_VALUE_REVIEW_REQUIRED')}
        }
      }
    }
  }
}
function PS-Constant($node,[int]$depth=0) {
  if($null -eq $node){return $null}
  if($depth -gt 40){[void]$failures.Add('NATIVE_CONSTANT_DEPTH_LIMIT');return $null}
  switch($node.GetType().Name){
    'StringConstantExpressionAst' {return $node.Value}
    'ConstantExpressionAst' {if($null -ne $node.Value -and $node.Value -isnot [bool]){return [Convert]::ToString($node.Value,[Globalization.CultureInfo]::InvariantCulture)};return $null}
    'ExpandableStringExpressionAst' {
      if($node.NestedExpressions.Count){[void]$failures.Add('POWERSHELL_INTERPOLATION_REVIEW_REQUIRED');return $null};return $node.Value
    }
    'ParenExpressionAst' {return PS-Constant $node.Pipeline ($depth+1)}
    'PipelineAst' {if($node.PipelineElements.Count -eq 1){return PS-Constant $node.PipelineElements[0] ($depth+1)};return $null}
    'CommandExpressionAst' {return PS-Constant $node.Expression ($depth+1)}
    'StatementBlockAst' {if($node.Statements.Count -eq 1){return PS-Constant $node.Statements[0] ($depth+1)};return $null}
    'BinaryExpressionAst' {
      if([string]$node.Operator -eq 'Plus'){$a=PS-Constant $node.Left ($depth+1);$b=PS-Constant $node.Right ($depth+1);if($null -ne $a -and $null -ne $b){return $a+$b}}
      if([string]$node.Operator -eq 'Format'){[void]$failures.Add('POWERSHELL_FORMAT_REVIEW_REQUIRED')};return $null
    }
    'ConvertExpressionAst' {
      $v=PS-Constant $node.Child ($depth+1)
      if($null -ne $v){
        if($node.Type.TypeName.FullName -in @('string','System.String')){return $v}
        if($node.Type.TypeName.FullName -in @('char','System.Char') -and $v -eq '0'){return [string][char]0}
        [void]$failures.Add('POWERSHELL_CONSTANT_CONVERSION_REVIEW_REQUIRED')
      };return $null
    }
  };return $null
}
function PS-Name($node,[int]$depth=0){
  if($null -eq $node){return ''}
  if($depth -gt 40){[void]$failures.Add('NATIVE_NAME_DEPTH_LIMIT');return ''}
  switch($node.GetType().Name){
    'VariableExpressionAst' {return $node.VariablePath.UserPath}
    'ConvertExpressionAst' {return PS-Name $node.Child ($depth+1)}
    'AttributedExpressionAst' {return PS-Name $node.Child ($depth+1)}
    'ArrayLiteralAst' {foreach($element in $node.Elements){PS-Name $element ($depth+1)};return}
    'ParenExpressionAst' {return PS-Name $node.Pipeline ($depth+1)}
    'PipelineAst' {if($node.PipelineElements.Count -eq 1){return PS-Name $node.PipelineElements[0] ($depth+1)}}
    'CommandExpressionAst' {return PS-Name $node.Expression ($depth+1)}
    'MemberExpressionAst' {$name=PS-Constant $node.Member;if($null -ne $name){return $name}}
    'IndexExpressionAst' {$name=PS-Constant $node.Index;if($null -ne $name){return $name}}
  }
  [void]$failures.Add('POWERSHELL_ASSIGNMENT_TARGET_REVIEW_REQUIRED');return ''
}
function Add-PSAssignment([string]$key,$node){
  if(!$key -or $null -eq $node){return}
  $values=[Collections.Generic.HashSet[string]]::new()
  foreach($n in $node.FindAll({param($x) $true},$true)){$v=PS-Constant $n;if($null -ne $v -and $v.Length){[void]$values.Add($v)}}
  if($values.Count){$assignments.Add(@{key=$key;values=@($values)})}
}
function Inspect-PS([string]$source){
  $lexical=$null;$parseErrors=$null
  $root=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$lexical,[ref]$parseErrors)
  if($parseErrors.Count){[void]$failures.Add('POWERSHELL_PARSE_FAILED');return}
  foreach($node in $root.FindAll({param($x) $true},$true)){
    if(++$script:nodeCount -gt 100000){throw 'NATIVE_NODE_LIMIT'}
    Add-Literal (PS-Constant $node)
    switch($node.GetType().Name){
      'AssignmentStatementAst' {foreach($name in @(PS-Name $node.Left)){Add-PSAssignment $name $node.Right}}
      'ParameterAst' {if($node.DefaultValue){foreach($name in @(PS-Name $node.Name)){Add-PSAssignment $name $node.DefaultValue}}}
      'PropertyMemberAst' {if($node.InitialValue){Add-PSAssignment $node.Name $node.InitialValue}}
      'HashtableAst' {foreach($pair in $node.KeyValuePairs){Add-PSAssignment (PS-Constant $pair.Item1) $pair.Item2}}
      'InvokeMemberExpressionAst' {
        $member=PS-Constant $node.Member
        if($member -in @('FromBase64String','FromHexString','GetString') -and $node.Arguments.Count -and $null -ne (PS-Constant $node.Arguments[0])){[void]$failures.Add('NATIVE_ENCODED_VALUE_REVIEW_REQUIRED')}
        if($member -eq 'Create' -and $node.Expression.Extent.Text -match 'scriptblock'){[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}
      }
      'CommandAst' {
        $name=$node.GetCommandName()
        # Normalize module-qualified names as syntax data, never by resolving or
        # importing the named module. Other qualified forms require review.
        if($name -and ($name.Contains('\') -or $name.Contains('/'))){
          if($name -match '^[^\\/:]+\\([^\\/:]+)$'){$name=$Matches[1]}
          else{[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED');$name=$null}
        }
        if(!$name -or [string]$node.InvocationOperator -eq 'Dot'){[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}
        if($name -in @('Invoke-Expression','iex')){[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}
        if($name -eq 'Add-Type'){
          $elements=$node.CommandElements
          $modeFound=$false
          for($i=1;$i -lt $elements.Count;$i++){
            if($elements[$i] -is [Management.Automation.Language.CommandParameterAst] -and $elements[$i].ParameterName -eq 'Path'){$modeFound=$true}
            if($elements[$i] -is [Management.Automation.Language.CommandParameterAst] -and $elements[$i].ParameterName -eq 'TypeDefinition'){
              $modeFound=$true
              $arg=$elements[$i].Argument
              if($null -eq $arg -and $i+1 -lt $elements.Count){$arg=$elements[$i+1]}
              $code=PS-Constant $arg
              if($null -eq $code){[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}else{Inspect-CS $code 1}
            }
          }
          if(!$modeFound){
            if($elements.Count -gt 1 -and $elements[1] -isnot [Management.Automation.Language.CommandParameterAst]){
              $code=PS-Constant $elements[1]
              if($null -eq $code){[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}else{Inspect-CS $code 1}
            }else{[void]$failures.Add('POWERSHELL_DYNAMIC_CODE_REVIEW_REQUIRED')}
          }
        }
      }
    }
  }
}
try {
  $inputText=[Console]::In.ReadToEnd()
  if($inputText.Length -gt 1500000){throw 'NATIVE_SOURCE_LIMIT'}
  $request=$inputText | ConvertFrom-Json -Depth 5
  if($request.language -notin @('cs','ps1')){throw 'NATIVE_LANGUAGE_INVALID'}
  $bytes=[Convert]::FromBase64String($request.base64)
  if($bytes.Length -gt 1048576){throw 'NATIVE_SOURCE_LIMIT'}
  $source=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
  [Reflection.Assembly]::LoadFrom((Join-Path $PSHOME 'Microsoft.CodeAnalysis.dll')) | Out-Null
  [Reflection.Assembly]::LoadFrom((Join-Path $PSHOME 'Microsoft.CodeAnalysis.CSharp.dll')) | Out-Null
  if($request.language -eq 'cs'){Inspect-CS $source}else{Inspect-PS $source}
  $report=@{literals=@($literals);assignments=@($assignments.ToArray());errors=@($failures);
    runtime=@{automationAssembly=[Management.Automation.PSObject].Assembly.Location}} | ConvertTo-Json -Compress -Depth 6
  if($report.Length -gt 3000000){throw 'NATIVE_FACT_LIMIT'}
  [Console]::Out.WriteLine($report)
}catch{
  # Exception messages may contain scanned contents. Emit only a fixed code.
  [Console]::Out.WriteLine('{"literals":[],"assignments":[],"errors":["NATIVE_PARSER_FAILED"]}')
}
