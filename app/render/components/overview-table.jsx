import React from 'react';
import {Table, TableBody, TableHeader, TableHeaderColumn, TableRow, TableRowColumn} from 'material-ui/Table';
import IconAscending from 'material-ui/svg-icons/communication/call-made';
import IconDecending from 'material-ui/svg-icons/communication/call-received';
var { ipcRenderer } = window.require('electron');

var OverviewTable = React.createClass({
	getInitialState() {
		var inst = this;
		ipcRenderer.on('reload-table', function(event, data) {
			console.log(data);
			inst.setState(data);
		});
		return {
			// Raw data, for now
			students: [
				{
					name: 'Natsu Kagami',
					total: 40,
					problems: {
						GIFTS: {
							score: 10,
							details: {
								'Test00': {
									score: 1,
									time: 0.001, // in seconds
									mem: 128, // in kilobytes
									result: 'Kết quả đúng'
								}
							}
						},
						DOMINO: {
							score: 10,
							details: []
						},
						COLOR: {
							score: 10,
							details: []
						},
						PAREN: {
							score: 10,
							details: []
						}
					}
				}, {
					name: 'Pham Chi Bach',
					total: 30,
					problems: {
						COLOR: {
							score: 1,
							details: []
						},
						PAREN: {
							score: 10,
							details: []
						},
						GIFTS: {
							score: 10,
							details: []
						},
						DOMINO: {
							score: 9,
							details: []
						}
					}
				}
			],
			problems: [
				'GIFTS', 'DOMINO', 'COLOR', 'PAREN'
			],
			currentOrder: {
				col: '__name',
				order: 1 // 1 = ascending, -1 = decending
			}
		};
	},
	handleHeaderClick(event) {
		if (event.target.getAttribute('data-colName') === undefined) return;
		var target = event.target;
		this.setState(function(state, props) {
			var newState = {};
			if (target.getAttribute('data-colName') === state.currentOrder.col) {
				newState.currentOrder = {
					col: state.currentOrder.col,
					order: state.currentOrder.order * -1
				};
			} else newState.currentOrder = {
				col: target.getAttribute('data-colName'),
				order: 1
			};
			state.students.sort(function(a, b) {
				var x, y;
				if (newState.currentOrder.col === '__name') {
					x = a.name, y = b.name;
				} else if (newState.currentOrder.col === '__total') {
					x = a.total, y = b.total;
				} else {
					var pName = newState.currentOrder.col;
					x = ((typeof a.problems[pName]) === 'object' ? a.problems[pName].score : -1);
					y = ((typeof b.problems[pName]) === 'object' ? b.problems[pName].score : -1);
				}
				var ans = (x < y ? -1 : (x === y ? 0 : 1)) * newState.currentOrder.order;
				return ans;
			});
			newState.students = state.students;
			console.log(newState);
			return newState;
		});
	},
	renderHeader(name, colname) {
		var added = '';
		if (colname === this.state.currentOrder.col) {
			added = <span>
				{(this.state.currentOrder.order == 1 ? <IconAscending style={{width: 14, height: 14}}/> :
					<IconDecending style={{width: 14, height: 14}}/>)}
			</span>;
		}
		return (<span>
					<span data-colName={colname} onClick={this.handleHeaderClick}>{name}</span>
					{added}
				</span>);
	},
	render() {
		var instance = this;
		var problemHeaders = this.state.problems.map(function(problem) {
			return (<TableHeaderColumn>
				{instance.renderHeader(problem, problem)}
			</TableHeaderColumn>);
		});
		var studentRows = this.state.students.map(function(student) {
			var problems = instance.state.problems.map(function(problem) {
				if (student.problems[problem] === undefined) {
					// No submissions
					return (<TableRowColumn></TableRowColumn>);
				}
				if (student.problems[problem] === 'CE') {
					// Compile error
					return (<TableRowColumn><span style={{color: 'red'}}>Dịch Lỗi</span></TableRowColumn>);
				}
				return (<TableRowColumn>{student.problems[problem].score}</TableRowColumn>);
			});
			return (
			<TableRow>
				<TableRowColumn>{student.name}</TableRowColumn>
				{problems}
				<TableRowColumn>{student.total}</TableRowColumn>
			</TableRow>
			);
		});
		return (
		<Table
			className='dynamicTable'
			height={Math.round(window.innerHeight * 0.6).toString() + 'px'}
			multiSelectable={true}
		>
			<TableHeader
				displaySelectAll={true}
			>
				<TableRow>
					<TableHeaderColumn>
						{this.renderHeader('Tên học sinh', '__name')}
					</TableHeaderColumn>
					{problemHeaders}
					<TableHeaderColumn>
						{this.renderHeader('Tổng Điểm', '__total')}
					</TableHeaderColumn>
				</TableRow>
			</TableHeader>
			<TableBody>
				{studentRows}
			</TableBody>
		</Table>
		);
	}
});

export default OverviewTable;
